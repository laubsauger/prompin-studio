import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js'; // Note .js extension for ESM/TS compilation
import { Asset, SyncStats } from '../../src/types.js';

export class IndexerService {
    private watcher: FSWatcher | null = null;
    private rootPath: string = '';
    private stats: SyncStats = {
        totalFiles: 0,
        processedFiles: 0,
        status: 'idle',
        lastSync: Date.now()
    };

    constructor() { }

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

    private async handleFileAdd(filePath: string) {
        if (!this.isMediaFile(filePath)) return;

        console.log(`File added: ${filePath}`);
        const relativePath = path.relative(this.rootPath, filePath);

        try {
            const stats = await fs.stat(filePath);
            const asset: Asset = {
                id: uuidv4(), // In real app, hash the path or content for stability
                path: relativePath,
                type: this.getMediaType(filePath),
                status: 'unsorted',
                createdAt: stats.birthtimeMs,
                updatedAt: stats.mtimeMs,
                metadata: {}
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
      INSERT INTO assets (id, path, type, status, createdAt, updatedAt, metadata)
      VALUES (@id, @path, @type, @status, @createdAt, @updatedAt, @metadata)
      ON CONFLICT(path) DO UPDATE SET
        updatedAt = excluded.updatedAt,
        metadata = excluded.metadata,
        status = excluded.status
    `);

        stmt.run({
            ...asset,
            metadata: JSON.stringify(asset.metadata)
        });
    }
}

export const indexerService = new IndexerService();
