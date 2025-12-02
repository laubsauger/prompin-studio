import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
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
        lastSync: Date.now()
    };

    constructor() {
        this.thumbnailCachePath = path.join(process.env.APP_ROOT || '', 'thumbnails');
        // Ensure thumbnail directory exists
        fs.mkdir(this.thumbnailCachePath, { recursive: true }).catch(console.error);
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
        this.stats.totalFiles = 0;
        this.stats.processedFiles = 0;

        this.watcher = watch(rootPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: false,
            depth: 99
        });

        this.watcher
            .on('add', (path: string) => {
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
                console.log('Initial scan complete');
            });
    }

    public async resync() {
        if (this.rootPath) {
            await this.setRootPath(this.rootPath);
        }
    }

    public getStats(): SyncStats {
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

    private async handleFileAdd(filePath: string) {
        if (!this.isMediaFile(filePath)) return;

        console.log(`File added: ${filePath}`);
        const relativePath = path.relative(this.rootPath, filePath);

        try {
            const stats = await fs.stat(filePath);
            const id = uuidv4();

            // Generate thumbnail for videos
            const thumbnailPath = await this.generateThumbnail(filePath, id);

            const asset: Asset = {
                id,
                path: relativePath,
                type: this.getMediaType(filePath),
                status: 'unsorted',
                createdAt: stats.birthtimeMs,
                updatedAt: stats.mtimeMs,
                metadata: {},
                thumbnailPath
            };

            this.upsertAsset(asset);
            this.stats.processedFiles++;
        } catch (err) {
            console.error(`Error processing file ${filePath}:`, err);
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
        return stmt.all().map((row: any) => ({
            ...row,
            metadata: JSON.parse(row.metadata)
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
}

export const indexerService = new IndexerService();
