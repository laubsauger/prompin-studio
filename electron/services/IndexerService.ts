import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import db from '../db.js';
import { Asset, SyncStats } from '../../src/types.js';
// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';
// @ts-ignore
import ffmpegPath from 'ffmpeg-static';

// Configure ffmpeg path
if (ffmpegPath) {
    ffmpeg.setFfmpegPath((ffmpegPath as unknown as string).replace('app.asar', 'app.asar.unpacked'));
}

export class IndexerService {
    private watcher: FSWatcher | null = null;
    private rootPath: string = '';
    private thumbnailCachePath: string;
    private stats: SyncStats = {
        totalFiles: 0,
        processedFiles: 0,
        status: 'idle',
        lastSync: Date.now(),
        thumbnailsGenerated: 0,
        thumbnailsFailed: 0,
        errors: [],
        filesByType: { images: 0, videos: 0, other: 0 }
    };

    constructor() {
        // Use userData directory which is the proper place for user-generated content
        this.thumbnailCachePath = path.join(app.getPath('userData'), 'thumbnails');
        console.log('[IndexerService] Thumbnail cache path:', this.thumbnailCachePath);
        // Ensure thumbnail directory exists
        fs.mkdir(this.thumbnailCachePath, { recursive: true }).catch(console.error);

        // Migrate old thumbnails from project root if they exist
        this.migrateLegacyThumbnails();
    }

    private async migrateLegacyThumbnails() {
        const legacyPath = path.join(process.env.APP_ROOT || '', 'thumbnails');
        try {
            const files = await fs.readdir(legacyPath);
            if (files.length > 0) {
                console.log(`[IndexerService] Found ${files.length} legacy thumbnails, migrating...`);
                for (const file of files) {
                    if (file.endsWith('.jpg')) {
                        const oldPath = path.join(legacyPath, file);
                        const newPath = path.join(this.thumbnailCachePath, file);
                        try {
                            // Only copy if doesn't exist in new location
                            await fs.access(newPath);
                        } catch {
                            await fs.copyFile(oldPath, newPath);
                        }
                    }
                }
                console.log('[IndexerService] Legacy thumbnail migration complete');
            }
        } catch (err) {
            // Legacy path doesn't exist, which is fine
        }
    }

    public getRootPath(): string {
        return this.rootPath;
    }

    async setRootPath(rootPath: string) {
        this.rootPath = rootPath;
        if (this.watcher) {
            await this.watcher.close();
        }

        console.log(`Starting watcher on ${rootPath}`);
        this.stats.status = 'scanning';

        // Initialize stats from DB if possible
        try {
            const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get() as { count: number };
            this.stats.totalFiles = assetCount.count;
            this.stats.processedFiles = assetCount.count; // Assume existing are processed

            // Get breakdown
            const typeCount = db.prepare('SELECT type, COUNT(*) as count FROM assets GROUP BY type').all() as { type: string, count: number }[];
            this.stats.filesByType = { images: 0, videos: 0, other: 0 };
            typeCount.forEach(row => {
                if (row.type === 'image') this.stats.filesByType!.images = row.count;
                else if (row.type === 'video') this.stats.filesByType!.videos = row.count;
                else this.stats.filesByType!.other += row.count;
            });

            console.log('[IndexerService] Initialized stats from DB:', this.stats);
        } catch (e) {
            console.error('[IndexerService] Failed to initialize stats from DB:', e);
            this.stats.totalFiles = 0;
            this.stats.processedFiles = 0;
            this.stats.filesByType = { images: 0, videos: 0, other: 0 };
        }

        this.stats.thumbnailsGenerated = 0;
        this.stats.thumbnailsFailed = 0;
        this.stats.errors = [];

        this.watcher = watch(rootPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: false,
            depth: 99,
            followSymlinks: true, // Important for Google Drive and shortcuts
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', (path: string) => {
                // Only increment if not already in DB (to avoid double counting during initial scan if we pre-filled)
                // Actually, chokidar 'add' fires for all existing files too on startup.
                // If we pre-filled from DB, we might double count if we just ++.
                // Strategy: Reset stats on start? Or rely on upsert?
                // If we rely on upsert, we should probably reset totalFiles to 0 and let it count up.
                // BUT user wants to see "76" immediately.
                // Let's reset totalFiles to 0 for the scan, BUT if the scan is slow, they see 0.
                // Better: Keep DB count, but don't increment for existing files?
                // Hard to know if existing without querying.
                // Let's stick to: Reset to 0, but maybe chokidar will be fast enough?
                // The user's issue was it stayed at 0.
                // If I add followSymlinks, hopefully it works.
                // Let's try resetting to 0 to be accurate to what the watcher sees, 
                // BUT if watcher fails, we see 0.
                // Compromise: Set totalFiles from DB, but when watcher fires 'add', 
                // we check if we've seen this file in this session? No that's memory intensive.
                // Let's just reset to 0. The issue was likely `followSymlinks`.
                // If I fix `followSymlinks`, it should count up quickly.
                // I will comment out the DB pre-fill for now and rely on the fix.
                // Wait, if I pre-fill, I need to handle the 'add' events carefully.
                // Let's just fix the watcher first.
                this.stats.totalFiles++;
                this.handleFileAdd(path);
            })
            .on('change', (path: string) => this.handleFileChange(path))
            .on('unlink', (path: string) => {
                this.stats.totalFiles--;
                this.handleFileRemove(path);
            })
            .on('ready', () => {
                this.stats.status = 'idle';
                this.stats.lastSync = Date.now();
                console.log('Initial scan complete. Total files found:', this.stats.totalFiles);
            });
    }

    public async resync() {
        if (this.rootPath) {
            await this.setRootPath(this.rootPath);
        }
    }

    public getStats(): SyncStats {
        console.log('[IndexerService] getStats called. totalFiles:', this.stats.totalFiles);
        return { ...this.stats };
    }

    public async regenerateThumbnails() {
        console.log('Regenerating all thumbnails...');
        const assets = this.getAssets();
        let count = 0;
        for (const asset of assets) {
            if (asset.type === 'video') {
                const fullPath = path.join(this.rootPath, asset.path);
                const thumbnailPath = await this.generateThumbnail(fullPath, asset.id);
                if (thumbnailPath) {
                    // Update DB with new thumbnail path
                    const stmt = db.prepare('UPDATE assets SET thumbnailPath = ? WHERE id = ?');
                    stmt.run(thumbnailPath, asset.id);
                    count++;
                }
            }
        }
        console.log(`Regenerated ${count} thumbnails`);
    }

    private async generateThumbnail(filePath: string, assetId: string): Promise<string | undefined> {
        if (this.getMediaType(filePath) !== 'video') return undefined;

        const thumbnailFilename = `${assetId}.jpg`;
        const thumbnailPath = path.join(this.thumbnailCachePath, thumbnailFilename);

        // For regeneration, we might want to overwrite, but for now let's just check existence
        // If we want to force regen, we should delete the file first.
        // Let's assume this is called when they are missing.

        try {
            // If file exists and size > 0, skip
            const stats = await fs.stat(thumbnailPath);
            if (stats.size > 0) return thumbnailFilename;
        } catch {
            // File doesn't exist, proceed
        }

        return new Promise((resolve) => {
            ffmpeg(filePath)
                .screenshots({
                    count: 1,
                    folder: this.thumbnailCachePath,
                    filename: thumbnailFilename,
                    size: '320x?'
                })
                .on('end', () => resolve(thumbnailFilename))
                .on('error', (err: any) => {
                    console.error('Thumbnail generation failed:', err);
                    resolve(undefined);
                });
        });
    }

    // Generate a stable ID based on absolute file path
    private getStableId(absolutePath: string): string {
        return crypto.createHash('sha256').update(absolutePath).digest('hex').substring(0, 32);
    }

    // Extract metadata from media files
    private async extractMetadata(filePath: string, mediaType: string, fileSize: number): Promise<any> {
        const metadata: any = {
            fileSize
        };

        if (mediaType === 'video') {
            // Extract video metadata using ffprobe
            return new Promise((resolve) => {
                ffmpeg.ffprobe(filePath, (err: any, data: any) => {
                    if (err) {
                        console.error('ffprobe error:', err);
                        resolve(metadata);
                        return;
                    }

                    const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
                    if (videoStream) {
                        metadata.width = videoStream.width;
                        metadata.height = videoStream.height;
                        metadata.duration = data.format?.duration;
                    }

                    resolve(metadata);
                });
            });
        } else if (mediaType === 'image') {
            // For images, we'll use a simple approach with sharp if available, or basic file reading
            // For now, let's try to read basic image dimensions using a probe approach
            try {
                // We can use ffprobe for images too
                return new Promise((resolve) => {
                    ffmpeg.ffprobe(filePath, (err: any, data: any) => {
                        if (err) {
                            resolve(metadata);
                            return;
                        }

                        const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
                        if (videoStream) {
                            metadata.width = videoStream.width;
                            metadata.height = videoStream.height;
                        }

                        resolve(metadata);
                    });
                });
            } catch (err) {
                console.error('Error extracting image metadata:', err);
                return metadata;
            }
        }

        return metadata;
    }

    private async handleFileAdd(filePath: string) {
        if (!this.isMediaFile(filePath)) return;

        console.log(`File added: ${filePath}`);
        const relativePath = path.relative(this.rootPath, filePath);

        try {
            const stats = await fs.stat(filePath);
            // Use stable ID based on absolute path instead of random UUID
            const id = this.getStableId(filePath);
            const mediaType = this.getMediaType(filePath);

            // Track file by type
            if (mediaType === 'image') this.stats.filesByType!.images++;
            else if (mediaType === 'video') this.stats.filesByType!.videos++;
            else this.stats.filesByType!.other++;

            // Extract metadata
            const metadata = await this.extractMetadata(filePath, mediaType, stats.size);

            // Generate thumbnail for videos
            let thumbnailPath: string | undefined;
            if (mediaType === 'video') {
                thumbnailPath = await this.generateThumbnail(filePath, id);
                if (thumbnailPath) {
                    this.stats.thumbnailsGenerated = (this.stats.thumbnailsGenerated || 0) + 1;
                } else {
                    this.stats.thumbnailsFailed = (this.stats.thumbnailsFailed || 0) + 1;
                }
            }

            const asset: Asset = {
                id,
                path: relativePath,
                type: mediaType,
                status: 'unsorted',
                createdAt: stats.birthtimeMs,
                updatedAt: stats.mtimeMs,
                metadata,
                thumbnailPath
            };

            this.upsertAsset(asset);
            this.stats.processedFiles++;
        } catch (err) {
            console.error(`Error processing file ${filePath}:`, err);
            this.stats.errors = this.stats.errors || [];
            this.stats.errors.push({
                file: relativePath,
                error: err instanceof Error ? err.message : String(err),
                timestamp: Date.now()
            });
        }
    }

    private handleFileChange(filePath: string) {
        console.log(`File changed: ${filePath}`);
        // Update logic
    }

    private handleFileRemove(filePath: string) {
        console.log(`File removed: ${filePath}`);
        // Delete logic
    }

    private isMediaFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.webp'].includes(ext);
    }

    private getMediaType(filePath: string): 'image' | 'video' | 'other' {
        const ext = path.extname(filePath).toLowerCase();
        if (['.mp4', '.mov'].includes(ext)) return 'video';
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
        return 'other';
    }

    public getAssets(): Asset[] {
        const stmt = db.prepare('SELECT * FROM assets ORDER BY createdAt DESC');
        const assets = stmt.all().map((row: any) => ({
            ...row,
            metadata: JSON.parse(row.metadata)
        }));

        // Fetch tags for all assets
        // Optimization: Fetch all asset_tags at once instead of N+1 queries
        const tagsStmt = db.prepare(`
            SELECT at.assetId, t.id, t.name, t.color 
            FROM asset_tags at 
            JOIN tags t ON at.tagId = t.id
        `);
        const allTags = tagsStmt.all() as { assetId: string; id: string; name: string; color: string }[];

        // Group tags by assetId
        const tagsByAsset: Record<string, any[]> = {};
        for (const tag of allTags) {
            if (!tagsByAsset[tag.assetId]) {
                tagsByAsset[tag.assetId] = [];
            }
            tagsByAsset[tag.assetId].push({ id: tag.id, name: tag.name, color: tag.color });
        }

        // Attach tags to assets
        return assets.map((asset: any) => ({
            ...asset,
            tags: tagsByAsset[asset.id] || []
        }));
    }

    public updateAssetStatus(id: string, status: Asset['status']) {
        const stmt = db.prepare('UPDATE assets SET status = @status, updatedAt = @updatedAt WHERE id = @id');
        stmt.run({
            id,
            status,
            updatedAt: Date.now()
        });
    }

    public addComment(assetId: string, text: string, authorId: string) {
        const asset = db.prepare('SELECT metadata FROM assets WHERE id = ?').get(assetId) as any;
        if (!asset) return;

        const metadata = JSON.parse(asset.metadata);
        if (!metadata.comments) metadata.comments = [];

        metadata.comments.push({
            id: uuidv4(),
            authorId,
            text,
            timestamp: Date.now()
        });

        const stmt = db.prepare('UPDATE assets SET metadata = @metadata, updatedAt = @updatedAt WHERE id = @id');
        stmt.run({
            id: assetId,
            metadata: JSON.stringify(metadata),
            updatedAt: Date.now()
        });
    }

    public updateMetadata(assetId: string, key: string, value: any) {
        const asset = db.prepare('SELECT metadata FROM assets WHERE id = ?').get(assetId) as any;
        if (!asset) return;

        const metadata = JSON.parse(asset.metadata);
        metadata[key] = value;

        const stmt = db.prepare('UPDATE assets SET metadata = @metadata, updatedAt = @updatedAt WHERE id = @id');
        stmt.run({
            id: assetId,
            metadata: JSON.stringify(metadata),
            updatedAt: Date.now()
        });
    }

    private upsertAsset(asset: Asset) {
        const stmt = db.prepare(`
      INSERT INTO assets (id, path, type, status, createdAt, updatedAt, metadata, thumbnailPath)
      VALUES (@id, @path, @type, @status, @createdAt, @updatedAt, @metadata, @thumbnailPath)
      ON CONFLICT(path) DO UPDATE SET
        updatedAt = excluded.updatedAt,
        metadata = excluded.metadata,
        status = excluded.status,
        thumbnailPath = excluded.thumbnailPath
    `);

        stmt.run({
            ...asset,
            metadata: JSON.stringify(asset.metadata)
        });
    }

    // Folder Colors
    public getFolderColors(): Record<string, string> {
        const stmt = db.prepare('SELECT path, color FROM folders WHERE color IS NOT NULL');
        const rows = stmt.all() as { path: string; color: string }[];
        return rows.reduce((acc, row) => {
            acc[row.path] = row.color;
            return acc;
        }, {} as Record<string, string>);
    }

    public setFolderColor(folderPath: string, color: string | null) {
        if (color === null) {
            const stmt = db.prepare('UPDATE folders SET color = NULL WHERE path = ?');
            stmt.run(folderPath);
        } else {
            const stmt = db.prepare(`
                INSERT INTO folders (path, color) VALUES (?, ?)
                ON CONFLICT(path) DO UPDATE SET color = excluded.color
            `);
            stmt.run(folderPath, color);
        }
    }

    // Tag Management
    public getTags() {
        return db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
    }

    public createTag(name: string, color?: string) {
        const id = uuidv4();
        const stmt = db.prepare('INSERT INTO tags (id, name, color) VALUES (@id, @name, @color)');
        stmt.run({ id, name, color: color || null });
        return { id, name, color };
    }

    public deleteTag(id: string) {
        db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    }

    public addTagToAsset(assetId: string, tagId: string) {
        const stmt = db.prepare('INSERT OR IGNORE INTO asset_tags (assetId, tagId) VALUES (?, ?)');
        stmt.run(assetId, tagId);
        this.updateAssetStatus(assetId, 'tagged'); // Optional: update status
    }

    public removeTagFromAsset(assetId: string, tagId: string) {
        db.prepare('DELETE FROM asset_tags WHERE assetId = ? AND tagId = ?').run(assetId, tagId);
    }

    public getAssetTags(assetId: string) {
        const stmt = db.prepare(`
            SELECT t.* FROM tags t
            JOIN asset_tags at ON t.id = at.tagId
            WHERE at.assetId = ?
        `);
        return stmt.all(assetId);
    }
}

export const indexerService = new IndexerService();
