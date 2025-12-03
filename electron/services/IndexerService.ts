import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { app, BrowserWindow } from 'electron';
import db from '../db.js';
import { Asset, SyncStats, AssetMetadata } from '../../src/types.js';
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
    private mainWindow: BrowserWindow | null = null;
    private stats: SyncStats = {
        totalFiles: 0,
        processedFiles: 0,
        totalFolders: 0,
        status: 'idle',
        lastSync: Date.now(),
        thumbnailsGenerated: 0,
        thumbnailsFailed: 0,
        errors: [],
        filesByType: { images: 0, videos: 0, other: 0 },
        skippedFiles: 0
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

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
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
        // Resolve the real path to handle symlinks/shortcuts (crucial for Google Drive)
        try {
            this.rootPath = await fs.realpath(rootPath);
            console.log(`[IndexerService] Resolved root path: ${rootPath} -> ${this.rootPath}`);
        } catch (error) {
            console.warn(`[IndexerService] Failed to resolve real path for ${rootPath}, using original. Error:`, error);
            this.rootPath = rootPath;
        }

        if (this.watcher) {
            await this.watcher.close();
        }

        console.log(`Starting watcher on ${this.rootPath}`);

        this.stats.status = 'scanning';

        // Reset stats for fresh count
        this.stats.totalFiles = 0;
        this.stats.processedFiles = 0;
        this.stats.totalFolders = 0;
        this.stats.thumbnailsGenerated = 0;
        this.stats.thumbnailsFailed = 0;
        this.stats.errors = [];
        this.stats.filesByType = { images: 0, videos: 0, other: 0 };
        this.stats.skippedFiles = 0;
        this.stats.thumbnailProgress = { current: 0, total: 0 };

        // CLEANUP: Remove stale data from previous root paths
        console.log('[IndexerService] Cleaning up stale data...');
        try {
            // Delete assets that don't belong to the current root path
            const deleteAssets = db.prepare('DELETE FROM assets WHERE rootPath != ?');
            const assetsResult = deleteAssets.run(this.rootPath);
            console.log(`[IndexerService] Deleted ${assetsResult.changes} stale assets.`);

            // Delete folders that are not within the current root path
            // We use a LIKE query to match paths starting with the root path
            // Note: We append a separator to ensure we don't match partial folder names (e.g. /root vs /root2)
            // But rootPath might not have a trailing slash.
            // Actually, for folders, we store the full absolute path.
            // So we can delete where path does not start with rootPath.
            const deleteFolders = db.prepare('DELETE FROM folders WHERE path NOT LIKE ?');
            const foldersResult = deleteFolders.run(`${this.rootPath}%`);
            console.log(`[IndexerService] Deleted ${foldersResult.changes} stale folders.`);
        } catch (error) {
            console.error('[IndexerService] Failed to cleanup stale data:', error);
        }

        // 1. Fast Pre-Scan to get accurate counts
        console.log('[IndexerService] Starting fast pre-scan...');
        await this.preScan(this.rootPath);
        console.log(`[IndexerService] Pre-scan complete. Found ${this.stats.totalFiles} files.`);

        // 2. Manual recursive scan to index files (fast, no thumbnails)
        console.log('[IndexerService] Starting manual recursive scan...');
        this.scanDirectory(this.rootPath).then(async () => {
            console.log('[IndexerService] Manual scan complete.');

            // 3. Start background thumbnail generation
            this.processThumbnails();

            this.stats.status = 'idle';
            this.stats.lastSync = Date.now();
        }).catch(err => {
            console.error('[IndexerService] Manual scan failed:', err);
            this.stats.status = 'idle';
        });

        this.watcher = watch(this.rootPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true, // We are doing manual scan, so ignore initial to avoid duplicates/race conditions
            depth: 99,
            followSymlinks: true, // Important for Google Drive and shortcuts
            usePolling: true, // Force polling for network/virtual drives
            interval: 2000, // Slower polling to reduce CPU
            binaryInterval: 2000,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', (path: string) => {
                // console.log(`[Watcher] File added: ${path}`);
                this.stats.totalFiles++;
                this.handleFileAdd(path);
            })
            .on('addDir', (path: string) => {
                this.stats.totalFolders = (this.stats.totalFolders || 0) + 1;
                console.log(`Folder added: ${path} (total: ${this.stats.totalFolders})`);
            })
            .on('unlinkDir', (path: string) => {
                this.stats.totalFolders = Math.max(0, (this.stats.totalFolders || 0) - 1);
                console.log(`Folder removed: ${path} (total: ${this.stats.totalFolders})`);
            })
            .on('change', (path: string) => this.handleFileChange(path))
            .on('unlink', (path: string) => {
                this.stats.totalFiles--;
                this.handleFileRemove(path);
            })
            .on('ready', () => {
                console.log('Watcher ready.');
            });

        // Immediately re-home existing assets to the new root path
        this.rehomeAssets(this.rootPath);
    }

    private async preScan(dirPath: string) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.name.startsWith('.')) continue; // Skip dotfiles

                if (entry.isDirectory()) {
                    this.stats.totalFolders = (this.stats.totalFolders || 0) + 1;
                    await this.preScan(fullPath);
                } else if (entry.isFile()) {
                    if (this.isMediaFile(fullPath)) {
                        this.stats.totalFiles++;
                    } else {
                        this.stats.skippedFiles = (this.stats.skippedFiles || 0) + 1;
                    }
                }
            }
        } catch (error) {
            console.error(`[Pre-Scan] Error scanning directory ${dirPath}:`, error);
        }
    }

    private async scanDirectory(dirPath: string) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.name.startsWith('.')) continue; // Skip dotfiles

                if (entry.isDirectory()) {
                    // Folders already counted in pre-scan
                    await this.scanDirectory(fullPath);
                } else if (entry.isFile()) {
                    // Files already counted in pre-scan
                    await this.handleFileAdd(fullPath, true); // true = skipThumbnail
                } else if (entry.isSymbolicLink()) {
                    // Follow symlinks manually if needed, but be careful of loops
                    // For now, let's try to resolve it
                    try {
                        const realPath = await fs.realpath(fullPath);
                        const stat = await fs.stat(realPath);
                        if (stat.isDirectory()) {
                            await this.scanDirectory(realPath);
                        } else if (stat.isFile()) {
                            // Files already counted in pre-scan (if we traversed symlinks there too? Pre-scan didn't handle symlinks explicitly yet, but let's assume standard structure)
                            // Actually pre-scan didn't handle symlinks. Let's just process here.
                            await this.handleFileAdd(realPath, true);
                        }
                    } catch (e) {
                        console.warn(`[Manual Scan] Failed to resolve symlink ${fullPath}:`, e);
                    }
                }
            }
        } catch (error) {
            console.error(`[Manual Scan] Error scanning directory ${dirPath}:`, error);
        }
    }

    private async processThumbnails() {
        console.log('[IndexerService] Starting background thumbnail generation...');

        // Find assets that need thumbnails (videos without thumbnailPath)
        // We can also check for images that need metadata extraction if we skipped it?
        // For now, let's focus on videos.
        const assets = this.getAssets();
        const videosNeedingThumbnails = assets.filter(a => a.type === 'video' && !a.thumbnailPath);

        this.stats.thumbnailProgress = {
            current: 0,
            total: videosNeedingThumbnails.length
        };

        for (const asset of videosNeedingThumbnails) {
            const fullPath = path.join(this.rootPath, asset.path);
            this.stats.currentFile = `Generating thumbnail: ${asset.path}`;

            try {
                const thumbnailPath = await this.generateThumbnail(fullPath, asset.id);
                if (thumbnailPath) {
                    // Update DB
                    const stmt = db.prepare('UPDATE assets SET thumbnailPath = ? WHERE id = ?');
                    stmt.run(thumbnailPath, asset.id);
                    this.stats.thumbnailsGenerated = (this.stats.thumbnailsGenerated || 0) + 1;
                } else {
                    this.stats.thumbnailsFailed = (this.stats.thumbnailsFailed || 0) + 1;
                }
            } catch (err) {
                console.error(`Failed to generate thumbnail for ${asset.path}:`, err);
                this.stats.thumbnailsFailed = (this.stats.thumbnailsFailed || 0) + 1;
            }

            if (this.stats.thumbnailProgress) {
                this.stats.thumbnailProgress.current++;
            }
        }

        this.stats.currentFile = undefined;
        this.stats.thumbnailProgress = undefined;
        console.log('[IndexerService] Background thumbnail generation complete.');
    }

    private rehomeAssets(newRootPath: string) {
        console.log(`[IndexerService] Re-homing assets to ${newRootPath}...`);
        try {
            // Fetch all assets to check if they belong to the new root
            // We select id, rootPath, path to calculate absolute path
            const allAssets = db.prepare('SELECT id, rootPath, path FROM assets').all() as { id: string; rootPath: string; path: string }[];

            const updates: { id: string; rootPath: string; path: string }[] = [];

            for (const asset of allAssets) {
                // Calculate absolute path based on stored rootPath and relative path
                const absolutePath = path.join(asset.rootPath, asset.path);

                // Check if this absolute path is within the new root path
                // We use startsWith but need to be careful about partial matches (e.g. /test vs /test2)
                // Adding a separator ensures we match directory boundaries
                const isWithin = absolutePath === newRootPath ||
                    absolutePath.startsWith(newRootPath + path.sep);

                if (isWithin) {
                    // Calculate new relative path
                    const newRelativePath = path.relative(newRootPath, absolutePath);

                    // Only update if the rootPath or path has effectively changed
                    if (asset.rootPath !== newRootPath || asset.path !== newRelativePath) {
                        updates.push({
                            id: asset.id,
                            rootPath: newRootPath,
                            path: newRelativePath
                        });
                    }
                }
            }

            if (updates.length > 0) {
                console.log(`[IndexerService] Found ${updates.length} assets to re-home.`);
                const stmt = db.prepare('UPDATE assets SET rootPath = @rootPath, path = @path WHERE id = @id');
                const updateTransaction = db.transaction((assetsToUpdate) => {
                    for (const update of assetsToUpdate) {
                        stmt.run(update);
                    }
                });
                updateTransaction(updates);
                console.log(`[IndexerService] Re-homing complete.`);
            } else {
                console.log(`[IndexerService] No assets needed re-homing.`);
            }
        } catch (error) {
            console.error('[IndexerService] Failed to re-home assets:', error);
        }
    }

    public async resync() {
        if (this.rootPath) {
            await this.setRootPath(this.rootPath);
        }
    }

    public getStats(): SyncStats {
        // console.log('[IndexerService] getStats called. totalFiles:', this.stats.totalFiles);
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

    private async generateThumbnail(filePath: string, assetId: string, force: boolean = false): Promise<string | undefined> {
        if (this.getMediaType(filePath) !== 'video') return undefined;

        const thumbnailFilename = `${assetId}.jpg`;
        const thumbnailPath = path.join(this.thumbnailCachePath, thumbnailFilename);

        try {
            // If file exists and size > 0, skip unless forced
            const stats = await fs.stat(thumbnailPath);
            if (!force && stats.size > 0) return thumbnailFilename;
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

    // Generate a stable ID based on file content (partial hash) AND rootPath to ensure isolation
    private async generateFileId(filePath: string): Promise<string> {
        try {
            const stats = await fs.stat(filePath);
            const fd = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(16 * 1024); // 16KB
            const { bytesRead } = await fd.read(buffer, 0, 16 * 1024, 0);
            await fd.close();

            return crypto.createHash('sha256')
                .update(buffer.subarray(0, bytesRead))
                .update(stats.size.toString())
                .update(this.rootPath) // Include rootPath to prevent collisions between projects
                .digest('hex')
                .substring(0, 32);
        } catch (error) {
            console.error(`Failed to generate hash for ${filePath}:`, error);
            // Fallback to path-based ID if file read fails
            return crypto.createHash('sha256')
                .update(path.normalize(filePath))
                .update(this.rootPath)
                .digest('hex')
                .substring(0, 32);
        }
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

    private async handleFileAdd(filePath: string, skipThumbnail: boolean = false) {
        if (!this.isMediaFile(filePath)) {
            // console.log(`[IndexerService] Skipped non-media file: ${filePath}`);
            // Already counted in pre-scan if we are in manual scan mode? 
            // If this is from watcher, we need to increment skippedFiles.
            // If from manual scan, we already handled it in pre-scan?
            // Actually, handleFileAdd is called by watcher too.
            // Let's just track it.
            // this.stats.skippedFiles = (this.stats.skippedFiles || 0) + 1;
            return;
        }

        const relativePath = path.relative(this.rootPath, filePath);
        this.stats.currentFile = relativePath;

        try {
            const stats = await fs.stat(filePath);
            const mediaType = this.getMediaType(filePath);

            // Generate ID based on content hash
            const id = await this.generateFileId(filePath);

            // Check if asset exists with this Hash ID
            let existing = db.prepare('SELECT updatedAt, thumbnailPath, rootPath, status, metadata, path FROM assets WHERE id = ?').get(id) as any;
            let isMigration = false;

            // If not found by Hash ID, check if it exists by Path (Migration from Path-ID)
            if (!existing) {
                const existingByPath = db.prepare('SELECT id, updatedAt, thumbnailPath, rootPath, status, metadata, path FROM assets WHERE rootPath = ? AND path = ?').get(this.rootPath, relativePath) as any;

                if (existingByPath) {
                    console.log(`[IndexerService] Migrating asset ${relativePath} from Path-ID to Hash-ID`);
                    existing = existingByPath;
                    isMigration = true;
                    db.prepare('DELETE FROM assets WHERE id = ?').run(existingByPath.id);
                }
            }

            if (existing && !isMigration) {
                // Normal update logic for existing Hash-ID asset
                if (existing.rootPath !== this.rootPath) {
                    console.log(`[IndexerService] Asset moved/renamed: ${existing.path} -> ${relativePath}`);
                } else {
                    // Check if modified time is effectively the same
                    const timeDiff = Math.abs(existing.updatedAt - stats.mtimeMs);
                    if (timeDiff < 1000 || existing.updatedAt > stats.mtimeMs) {
                        let skip = true;
                        if (mediaType === 'video' && !existing.thumbnailPath && !skipThumbnail) skip = false;
                        if (skip) return;
                    }
                }
            } else {
                console.log(`[IndexerService] New/Migrated file indexed: ${relativePath}`);
            }

            // console.log(`Processing file: ${filePath}`);

            // Track file by type
            if (mediaType === 'image') this.stats.filesByType!.images++;
            else if (mediaType === 'video') this.stats.filesByType!.videos++;
            else this.stats.filesByType!.other++;

            // Extract metadata if needed (or use existing)
            let metadata = existing?.metadata ? JSON.parse(existing.metadata) : {};

            // Always extract basic metadata for new/updated files to ensure correctness
            // Optimization: Skip expensive metadata extraction (ffprobe) during initial scan if possible?
            // For now, let's keep it but maybe skip if skipThumbnail is true?
            // Actually, we need dimensions for the grid.
            // Let's keep metadata extraction for now, it's usually faster than thumbnail generation.
            const newMetadata = await this.extractMetadata(filePath, mediaType, stats.size);
            metadata = { ...newMetadata, ...metadata };

            // Generate thumbnail if video
            let thumbnailPath = existing?.thumbnailPath;
            if (mediaType === 'video' && (!thumbnailPath || isMigration) && !skipThumbnail) {
                thumbnailPath = await this.generateThumbnail(filePath, id);
            }

            const asset: Asset = {
                id,
                path: relativePath,
                rootPath: this.rootPath,
                type: mediaType,
                status: (existing && existing.status && existing.status !== 'unsorted') ? existing.status : 'unsorted',
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
        this.handleFileAdd(filePath);
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
        console.log(`[IndexerService] getAssets called for rootPath: '${this.rootPath}'`);
        // Only return assets for the current root path
        const stmt = db.prepare('SELECT * FROM assets WHERE rootPath = ? ORDER BY createdAt DESC');
        const assets = stmt.all(this.rootPath).map((row: any) => ({
            ...row,
            metadata: JSON.parse(row.metadata)
        }));
        console.log(`[IndexerService] getAssets found ${assets.length} assets`);

        // Fetch tags for all assets
        // Optimization: Fetch all asset_tags at once instead of N+1 queries
        if (assets.length === 0) return [];

        const assetIds = assets.map((a: any) => a.id);
        const placeholders = assetIds.map(() => '?').join(', ');

        const tagsStmt = db.prepare(`
            SELECT at.assetId, t.id, t.name, t.color
            FROM asset_tags at
            JOIN tags t ON at.tagId = t.id
            WHERE at.assetId IN (${placeholders})
        `);
        const allTags = tagsStmt.all(...assetIds) as { assetId: string; id: string; name: string; color: string }[];

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

    public searchAssets(searchQuery: string, filters?: {
        type?: string;
        status?: string;
        authorId?: string;
        project?: string;
        scene?: string;
        shot?: string;
        platform?: string;
        platformUrl?: string;
        model?: string;
        tagIds?: string[];
        ids?: string[];
        dateFrom?: number;
        dateTo?: number;
        relatedToAssetId?: string;
    }): Asset[] {
        let sql = `
            SELECT DISTINCT a.* FROM assets a
        `;
        const params: any = { rootPath: this.rootPath };
        const conditions: string[] = ['a.rootPath = @rootPath'];

        // Add full-text search if query is provided
        if (searchQuery && searchQuery.trim() !== '') {
            sql += `
                JOIN assets_fts ON assets_fts.id = a.id
            `;
            conditions.push(`assets_fts MATCH @searchQuery`);
            params.searchQuery = searchQuery.split(' ').map(term =>
                term + '*'  // Add prefix matching for each term
            ).join(' ');
        }

        // Add tag joins if filtering by tags
        if (filters?.tagIds && filters.tagIds.length > 0) {
            conditions.push(`
                EXISTS (
                    SELECT 1 FROM asset_tags at 
                    WHERE at.assetId = a.id 
                    AND at.tagId IN (${filters.tagIds.map((_, i) => `@tagId${i}`).join(',')})
                )
            `);
            filters.tagIds.forEach((tagId, i) => {
                params[`tagId${i}`] = tagId;
            });
        }

        // Add ids filter
        if (filters?.ids && filters.ids.length > 0) {
            conditions.push(`a.id IN (${filters.ids.map((_, i) => `@id${i}`).join(',')})`);
            filters.ids.forEach((id, i) => {
                params[`id${i}`] = id;
            });
        }

        if (filters?.relatedToAssetId) {
            conditions.push(`
                EXISTS (
                    SELECT 1 FROM json_each(a.metadata, '$.inputs')
                    WHERE json_each.value = @relatedToAssetId
                )
            `);
            params.relatedToAssetId = filters.relatedToAssetId;
        }

        // Add filter conditions
        if (filters?.type) {
            conditions.push(`a.type = @type`);
            params.type = filters.type;
        }
        if (filters?.status) {
            conditions.push(`a.status = @status`);
            params.status = filters.status;
        }
        if (filters?.dateFrom) {
            conditions.push(`a.createdAt >= @dateFrom`);
            params.dateFrom = filters.dateFrom;
        }
        if (filters?.dateTo) {
            conditions.push(`a.createdAt <= @dateTo`);
            params.dateTo = filters.dateTo;
        }

        // Metadata filters (using JSON extraction)
        if (filters?.authorId) {
            conditions.push(`json_extract(a.metadata, '$.authorId') = @authorId`);
            params.authorId = filters.authorId;
        }
        if (filters?.project) {
            conditions.push(`json_extract(a.metadata, '$.project') = @project`);
            params.project = filters.project;
        }
        if (filters?.scene) {
            conditions.push(`json_extract(a.metadata, '$.scene') = @scene`);
            params.scene = filters.scene;
        }
        if (filters?.shot) {
            conditions.push(`json_extract(a.metadata, '$.shot') = @shot`);
            params.shot = filters.shot;
        }
        if (filters?.platform) {
            conditions.push(`json_extract(a.metadata, '$.platform') = @platform`);
            params.platform = filters.platform;
        }
        if (filters?.platformUrl) {
            conditions.push(`json_extract(a.metadata, '$.platformUrl') LIKE @platformUrl`);
            params.platformUrl = `%${filters.platformUrl}%`;
        }
        if (filters?.model) {
            conditions.push(`json_extract(a.metadata, '$.model') = @model`);
            params.model = filters.model;
        }

        // Combine conditions
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        // Order by relevance for full-text search, otherwise by creation date
        if (searchQuery && searchQuery.trim() !== '') {
            sql += ` ORDER BY rank, a.createdAt DESC`;
        } else {
            sql += ` ORDER BY a.createdAt DESC`;
        }

        const stmt = db.prepare(sql);
        const assets = stmt.all(params).map((row: any) => ({
            ...row,
            metadata: JSON.parse(row.metadata)
        }));

        // Fetch tags for filtered assets
        if (assets.length > 0) {
            const assetIds = assets.map((a: any) => a.id);
            const placeholders = assetIds.map(() => '?').join(', ');
            const tagsStmt = db.prepare(`
                SELECT at.assetId, t.id, t.name, t.color
                FROM asset_tags at
                JOIN tags t ON at.tagId = t.id
                WHERE at.assetId IN (${placeholders})
            `);
            const allTags = tagsStmt.all(...assetIds) as { assetId: string; id: string; name: string; color: string }[];

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

        return assets;
    }

    public getAsset(id: string): Asset | undefined {
        const assets = this.getAssets();
        return assets.find(a => a.id === id);
    }

    public getLineage(assetId: string): Asset[] {
        console.log(`[IndexerService] getLineage called for assetId: ${assetId}`);
        const assets = this.getAssets(); // Get all assets (unfiltered)
        const lineage = new Set<string>();
        const queue = [assetId];
        const processed = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (processed.has(currentId)) continue;
            processed.add(currentId);

            const asset = assets.find(a => a.id === currentId);
            if (!asset) continue;

            lineage.add(asset.id);

            // Add inputs (ancestors)
            if (asset.metadata.inputs) {
                for (const inputId of asset.metadata.inputs) {
                    if (!processed.has(inputId)) {
                        queue.push(inputId);
                    }
                }
            }

            // Add outputs (descendants)
            const outputs = assets.filter(a => a.metadata.inputs?.includes(asset.id));
            for (const output of outputs) {
                if (!processed.has(output.id)) {
                    queue.push(output.id);
                }
            }
        }

        return assets.filter(a => lineage.has(a.id));
    }

    public updateAssetStatus(id: string, status: Asset['status']) {
        console.log(`[IndexerService] updateAssetStatus: ${id} -> ${status}`);
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

    public updateAssetMetadata(assetId: string, metadata: AssetMetadata) {
        const stmt = db.prepare('UPDATE assets SET metadata = @metadata, updatedAt = @updatedAt WHERE id = @id');
        stmt.run({
            id: assetId,
            metadata: JSON.stringify(metadata),
            updatedAt: Date.now()
        });
    }

    private upsertAsset(asset: Asset) {
        const existing = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset.id);

        if (existing) {
            db.prepare(`
                UPDATE assets 
                SET path = @path, 
                    rootPath = @rootPath,
                    type = @type,
                    updatedAt = @updatedAt, 
                    status = @status, 
                    metadata = @metadata,
                    thumbnailPath = @thumbnailPath
                WHERE id = @id
            `).run({
                ...asset,
                metadata: JSON.stringify(asset.metadata)
            });
        } else {
            try {
                db.prepare(`
                    INSERT INTO assets (id, path, rootPath, type, createdAt, updatedAt, status, metadata, thumbnailPath)
                    VALUES (@id, @path, @rootPath, @type, @createdAt, @updatedAt, @status, @metadata, @thumbnailPath)
                `).run({
                    ...asset,
                    metadata: JSON.stringify(asset.metadata)
                });
                // If we have a main window, emit an update event for this specific asset
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('asset-updated', asset);
                }

                return asset;
            } catch (error: any) {
                // If there's a conflict (e.g., unique constraint violation on path),
                // it means the asset was likely added by another process or a previous run.
                // In this case, we attempt to update it instead.
                // This can happen if the file system watcher triggers multiple times for the same file.
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    console.warn(`[IndexerService] Conflict detected for asset ${asset.path}. Attempting to update.`);
                    const updateStmt = db.prepare(`
                        UPDATE assets
                        SET path = @path,
                            rootPath = @rootPath,
                            type = @type,
                            updatedAt = @updatedAt,
                            status = @status,
                            metadata = @metadata,
                            thumbnailPath = @thumbnailPath
                        WHERE id = @id
                    `);
                    updateStmt.run({
                        ...asset,
                        metadata: JSON.stringify(asset.metadata)
                    });

                    // Emit update for the new asset ID (since the old one is gone/updated)
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('asset-updated', asset);
                    }

                    return asset;
                }

                console.error('[IndexerService] Error upserting asset:', error);
                throw error;
            }
        }
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

    public getFolders(): string[] {
        // Return all unique directory paths from assets
        // We can also scan the filesystem, but DB is faster.
        // However, empty folders might not be in assets table if they have no media.
        // But the user said "structure needs to always be visible".
        // If we rely on assets, we miss empty folders.
        // But `IndexerService` tracks folders via `addDir`.
        // We don't store folders in DB unless they have color/metadata.
        // We can use `find` or `glob` to get all folders?
        // Or just rely on assets for now?
        // The previous implementation relied on assets.
        // "We never want to fully hide folders ever when we filter and search" implies folders that *contain* assets (or did before filtering).
        // So getting all unique paths from `assets` table (unfiltered) is probably enough for "structure of the project".
        // If a folder is truly empty (no files at all), it wouldn't show up before either.

        const stmt = db.prepare('SELECT DISTINCT path FROM assets WHERE rootPath = ?');
        const paths = stmt.all(this.rootPath) as { path: string }[];
        const folders = new Set<string>();

        paths.forEach(p => {
            const dir = path.dirname(p.path);
            if (dir !== '.') {
                // Add all parent directories
                let current = dir;
                while (current !== '.' && current !== '') {
                    folders.add(current);
                    current = path.dirname(current);
                }
            }
        });

        return Array.from(folders).sort();
    }

    // Tag Management
    public getTags() {
        // Return all tags to ensure newly created ones are visible
        // The previous implementation filtered by usage in rootPath, which hid unused tags.
        const stmt = db.prepare('SELECT * FROM tags ORDER BY name ASC');
        return stmt.all();
    }

    public createTag(name: string, color?: string) {
        try {
            const id = uuidv4();
            const stmt = db.prepare('INSERT INTO tags (id, name, color) VALUES (@id, @name, @color)');
            stmt.run({ id, name, color: color || null });
            return { id, name, color };
        } catch (err: any) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                // Return existing tag
                const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as any;
                if (existing) return existing;
            }
            throw err;
        }
    }

    public deleteTag(id: string) {
        db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    }

    public addTagToAsset(assetId: string, tagId: string) {
        const stmt = db.prepare('INSERT OR IGNORE INTO asset_tags (assetId, tagId) VALUES (?, ?)');
        stmt.run(assetId, tagId);

    }

    public removeTagFromAsset(assetId: string, tagId: string) {
        db.prepare('DELETE FROM asset_tags WHERE assetId = ? AND tagId = ?').run(assetId, tagId);
    }

    public async ingestFile(sourcePath: string, metadata: { project?: string; scene?: string; targetPath?: string }): Promise<Asset> {
        if (!this.rootPath) {
            throw new Error('Root path not set');
        }

        const fileName = path.basename(sourcePath);
        let relativeDestDir = '';

        if (metadata.targetPath) {
            relativeDestDir = metadata.targetPath;
        } else {
            // Default structure: uploads/project/scene (if scene exists) or uploads/project
            const project = metadata.project || 'default';
            relativeDestDir = path.join('uploads', project);
            if (metadata.scene) {
                relativeDestDir = path.join(relativeDestDir, metadata.scene);
            }
        }

        const destDir = path.join(this.rootPath, relativeDestDir);
        // Ensure directory exists
        await fs.mkdir(destDir, { recursive: true });

        let finalDestPath = path.join(destDir, fileName);
        let counter = 1;
        const ext = path.extname(fileName);
        const name = path.basename(fileName, ext);

        while (true) {
            try {
                await fs.access(finalDestPath);
                // File exists, try next name
                finalDestPath = path.join(destDir, `${name}_${counter}${ext}`);
                counter++;
            } catch {
                // File doesn't exist, use this path
                break;
            }
        }

        await fs.copyFile(sourcePath, finalDestPath);

        // Index the file immediately
        await this.handleFileAdd(finalDestPath);

        // Retrieve and return the asset
        const id = await this.generateFileId(finalDestPath);
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as any;

        if (!asset) {
            throw new Error('Failed to index ingested file');
        }

        return {
            ...asset,
            metadata: JSON.parse(asset.metadata),
            tags: this.getAssetTags(id)
        };
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
