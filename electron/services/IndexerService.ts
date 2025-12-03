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

import { Scanner } from './indexer/Scanner.js';
import { Watcher } from './indexer/Watcher.js';
import { MetadataExtractor } from './indexer/MetadataExtractor.js';
import { ThumbnailGenerator } from './indexer/ThumbnailGenerator.js';
import { AssetManager } from './indexer/AssetManager.js';

// Configure ffmpeg path
if (ffmpegPath) {
    ffmpeg.setFfmpegPath((ffmpegPath as unknown as string).replace('app.asar', 'app.asar.unpacked'));
}

export class IndexerService {
    private rootPath: string = '';
    private thumbnailCachePath: string;
    private mainWindow: BrowserWindow | null = null;

    private scanner: Scanner;
    private watcher: Watcher;
    private metadataExtractor: MetadataExtractor;
    private thumbnailGenerator: ThumbnailGenerator;
    private assetManager: AssetManager;

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
        this.thumbnailCachePath = path.join(app.getPath('userData'), 'thumbnails');
        fs.mkdir(this.thumbnailCachePath, { recursive: true }).catch(console.error);

        this.scanner = new Scanner(this.isMediaFile.bind(this));
        this.watcher = new Watcher();
        this.metadataExtractor = new MetadataExtractor();
        this.thumbnailGenerator = new ThumbnailGenerator(this.thumbnailCachePath);
        this.assetManager = new AssetManager();

        this.setupWatcher();
        this.migrateLegacyThumbnails();
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    public getRootPath(): string {
        return this.rootPath;
    }

    async setRootPath(rootPath: string) {
        try {
            this.rootPath = await fs.realpath(rootPath);
        } catch (error) {
            console.warn(`[IndexerService] Failed to resolve real path for ${rootPath}, using original.`, error);
            this.rootPath = rootPath;
        }

        await this.watcher.stop();
        this.watcher.start(this.rootPath);

        this.resetStats();
        this.stats.status = 'scanning';

        // 1. Fast Pre-Scan
        console.log('[IndexerService] Starting fast pre-scan...');
        this.scanner.resetStats();
        await this.scanner.preScan(this.rootPath);
        const scanStats = this.scanner.getStats();
        this.stats.totalFiles = scanStats.totalFiles;
        this.stats.totalFolders = scanStats.totalFolders;
        this.stats.skippedFiles = scanStats.skippedFiles;
        console.log(`[IndexerService] Pre-scan complete. Found ${this.stats.totalFiles} files.`);

        // 2. Manual Scan
        console.log('[IndexerService] Starting manual scan...');
        await this.scanner.scanDirectory(this.rootPath, async (filePath: string) => {
            await this.handleFileAdd(filePath, true); // Skip thumbnail initially
        });
        console.log('[IndexerService] Manual scan complete.');

        // 3. Background Thumbnails
        this.processThumbnails();

        this.stats.status = 'idle';
        this.stats.lastSync = Date.now();

        // Re-home assets (handle moves/renames of root)
        this.assetManager.rehomeAssets(this.rootPath);
    }

    private setupWatcher() {
        this.watcher.on('add', (path: string) => {
            this.stats.totalFiles++;
            this.handleFileAdd(path);
        });
        this.watcher.on('addDir', () => {
            this.stats.totalFolders = (this.stats.totalFolders || 0) + 1;
        });
        this.watcher.on('unlinkDir', () => {
            this.stats.totalFolders = Math.max(0, (this.stats.totalFolders || 0) - 1);
        });
        this.watcher.on('change', (path: string) => this.handleFileAdd(path));
        this.watcher.on('unlink', (path: string) => {
            this.stats.totalFiles--;
            // TODO: Handle file removal in DB
        });
    }

    private async handleFileAdd(filePath: string, skipThumbnail: boolean = false) {
        if (!this.isMediaFile(filePath)) return;

        const relativePath = path.relative(this.rootPath, filePath);
        this.stats.currentFile = relativePath;

        try {
            // Note: If filePath is a symlink, fs.stat gets stats of the target.
            // But we want to index it as if it's at filePath.
            const stats = await fs.stat(filePath);
            const mediaType = this.getMediaType(filePath);
            const id = await this.generateFileId(filePath);

            let existing = this.assetManager.getAsset(id);

            // Migration logic (Path-ID to Hash-ID)
            if (!existing) {
                const existingByPath = db.prepare('SELECT * FROM assets WHERE rootPath = ? AND path = ?').get(this.rootPath, relativePath) as any;
                if (existingByPath) {
                    existing = existingByPath;
                    db.prepare('DELETE FROM assets WHERE id = ?').run(existingByPath.id);
                }
            }

            if (existing) {
                if (existing.rootPath !== this.rootPath) {
                    // Asset moved/renamed
                } else {
                    const timeDiff = Math.abs(existing.updatedAt - stats.mtimeMs);
                    if (timeDiff < 1000 || existing.updatedAt > stats.mtimeMs) {
                        if (mediaType === 'video' && !existing.thumbnailPath && !skipThumbnail) {
                            // Needs thumbnail
                        } else {
                            return; // Skip if up to date
                        }
                    }
                }
            }

            if (mediaType === 'image') this.stats.filesByType!.images++;
            else if (mediaType === 'video') this.stats.filesByType!.videos++;
            else this.stats.filesByType!.other++;

            let metadata = existing?.metadata || {};
            const newMetadata = await this.metadataExtractor.extract(filePath, mediaType, stats.size);
            metadata = { ...newMetadata, ...metadata };

            let thumbnailPath = existing?.thumbnailPath;
            if (mediaType === 'video' && (!thumbnailPath) && !skipThumbnail) {
                thumbnailPath = await this.thumbnailGenerator.generate(filePath, id);
            }

            const asset: Asset = {
                id,
                path: relativePath,
                rootPath: this.rootPath,
                type: mediaType,
                status: (existing && existing.status !== 'unsorted') ? existing.status : 'unsorted',
                createdAt: stats.birthtimeMs,
                updatedAt: stats.mtimeMs,
                metadata,
                thumbnailPath: thumbnailPath || undefined
            };

            this.assetManager.upsertAsset(asset);
            this.stats.processedFiles++;

            if (this.mainWindow) {
                this.mainWindow.webContents.send('asset-updated', asset);
            }

        } catch (err) {
            console.error(`Error processing file ${filePath}:`, err);
            this.stats.errors!.push({
                file: relativePath,
                error: err instanceof Error ? err.message : String(err),
                timestamp: Date.now()
            });
        }
    }

    private async processThumbnails() {
        const assets = this.assetManager.getAssets(this.rootPath);
        await this.thumbnailGenerator.processQueue(
            assets,
            this.rootPath,
            (progress: { current: number; total: number }, currentFile: string) => {
                this.stats.thumbnailProgress = progress;
                this.stats.currentFile = currentFile;
            },
            (assetId: string, thumbnailPath: string) => {
                this.assetManager.updateThumbnail(assetId, thumbnailPath);
                this.stats.thumbnailsGenerated!++;
                // Notify frontend
                const asset = this.assetManager.getAsset(assetId);
                if (asset && this.mainWindow) {
                    this.mainWindow.webContents.send('asset-updated', asset);
                }
            }
        );
        this.stats.currentFile = undefined;
        this.stats.thumbnailProgress = undefined;
    }

    // Helper methods
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

    private async generateFileId(filePath: string): Promise<string> {
        try {
            const stats = await fs.stat(filePath);
            const fd = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(16 * 1024);
            const { bytesRead } = await fd.read(buffer, 0, 16 * 1024, 0);
            await fd.close();

            return crypto.createHash('sha256')
                .update(buffer.subarray(0, bytesRead))
                .update(stats.size.toString())
                .update(this.rootPath)
                .digest('hex')
                .substring(0, 32);
        } catch (error) {
            return crypto.createHash('sha256')
                .update(path.normalize(filePath))
                .update(this.rootPath)
                .digest('hex')
                .substring(0, 32);
        }
    }

    private resetStats() {
        this.stats = {
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
    }

    private async migrateLegacyThumbnails() {
        const legacyPath = path.join(process.env.APP_ROOT || '', 'thumbnails');
        try {
            const files = await fs.readdir(legacyPath);
            if (files.length > 0) {
                for (const file of files) {
                    if (file.endsWith('.jpg')) {
                        const oldPath = path.join(legacyPath, file);
                        const newPath = path.join(this.thumbnailCachePath, file);
                        try { await fs.access(newPath); } catch { await fs.copyFile(oldPath, newPath); }
                    }
                }
            }
        } catch { }
    }

    // Public API delegates
    public getAssets() { return this.assetManager.getAssets(this.rootPath); }
    public getAsset(id: string) { return this.assetManager.getAsset(id); }
    public getStats() { return { ...this.stats }; }
    public async resync() { if (this.rootPath) await this.setRootPath(this.rootPath); }
    public async regenerateThumbnails() {
        this.stats.thumbnailsGenerated = 0;
        await this.processThumbnails();
    }

    // Search Assets (Kept in IndexerService for now to ensure compatibility)
    public searchAssets(searchQuery: string, filters?: any): Asset[] {
        let sql = `SELECT DISTINCT a.* FROM assets a`;
        const params: any = { rootPath: this.rootPath };
        const conditions: string[] = ['a.rootPath = @rootPath'];

        if (searchQuery && searchQuery.trim() !== '') {
            sql += ` JOIN assets_fts ON assets_fts.id = a.id`;
            conditions.push(`assets_fts MATCH @searchQuery`);
            params.searchQuery = searchQuery.split(' ').map(term => term + '*').join(' ');
        }

        if (filters?.tagIds && filters.tagIds.length > 0) {
            conditions.push(`EXISTS (SELECT 1 FROM asset_tags at WHERE at.assetId = a.id AND at.tagId IN (${filters.tagIds.map((_: any, i: number) => `@tagId${i}`).join(',')}))`);
            filters.tagIds.forEach((tagId: string, i: number) => { params[`tagId${i}`] = tagId; });
        }

        if (filters?.ids && filters.ids.length > 0) {
            conditions.push(`a.id IN (${filters.ids.map((_: any, i: number) => `@id${i}`).join(',')})`);
            filters.ids.forEach((id: string, i: number) => { params[`id${i}`] = id; });
        }

        if (filters?.relatedToAssetId) {
            conditions.push(`EXISTS (SELECT 1 FROM json_each(a.metadata, '$.inputs') WHERE json_each.value = @relatedToAssetId)`);
            params.relatedToAssetId = filters.relatedToAssetId;
        }

        if (filters?.type) { conditions.push(`a.type = @type`); params.type = filters.type; }
        if (filters?.status) { conditions.push(`a.status = @status`); params.status = filters.status; }
        if (filters?.dateFrom) { conditions.push(`a.createdAt >= @dateFrom`); params.dateFrom = filters.dateFrom; }
        if (filters?.dateTo) { conditions.push(`a.createdAt <= @dateTo`); params.dateTo = filters.dateTo; }

        if (filters?.authorId) { conditions.push(`json_extract(a.metadata, '$.authorId') = @authorId`); params.authorId = filters.authorId; }
        if (filters?.project) { conditions.push(`json_extract(a.metadata, '$.project') = @project`); params.project = filters.project; }
        if (filters?.scene) { conditions.push(`json_extract(a.metadata, '$.scene') = @scene`); params.scene = filters.scene; }
        if (filters?.shot) { conditions.push(`json_extract(a.metadata, '$.shot') = @shot`); params.shot = filters.shot; }
        if (filters?.platform) { conditions.push(`json_extract(a.metadata, '$.platform') = @platform`); params.platform = filters.platform; }
        if (filters?.platformUrl) { conditions.push(`json_extract(a.metadata, '$.platformUrl') LIKE @platformUrl`); params.platformUrl = `%${filters.platformUrl}%`; }
        if (filters?.model) { conditions.push(`json_extract(a.metadata, '$.model') = @model`); params.model = filters.model; }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

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

            const tagsByAsset: Record<string, any[]> = {};
            for (const tag of allTags) {
                if (!tagsByAsset[tag.assetId]) tagsByAsset[tag.assetId] = [];
                tagsByAsset[tag.assetId].push({ id: tag.id, name: tag.name, color: tag.color });
            }

            return assets.map((asset: any) => ({
                ...asset,
                tags: tagsByAsset[asset.id] || []
            }));
        }

        return assets;
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
        const stmt = db.prepare('SELECT DISTINCT path FROM assets WHERE rootPath = ?');
        const paths = stmt.all(this.rootPath) as { path: string }[];
        const folders = new Set<string>();

        paths.forEach(p => {
            const dir = path.dirname(p.path);
            if (dir !== '.') {
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

    public getAssetTags(assetId: string) {
        const stmt = db.prepare(`
            SELECT t.* FROM tags t
            JOIN asset_tags at ON t.id = at.tagId
            WHERE at.assetId = ?
        `);
        return stmt.all(assetId);
    }

    public async ingestFile(sourcePath: string, metadata: { project?: string; scene?: string; targetPath?: string }): Promise<Asset> {
        if (!this.rootPath) throw new Error('Root path not set');

        const fileName = path.basename(sourcePath);
        let relativeDestDir = '';

        if (metadata.targetPath) {
            relativeDestDir = metadata.targetPath;
        } else {
            const project = metadata?.project || 'default';
            relativeDestDir = path.join('uploads', project);
            if (metadata?.scene) relativeDestDir = path.join(relativeDestDir, metadata?.scene);
        }

        const destDir = path.join(this.rootPath, relativeDestDir);
        await fs.mkdir(destDir, { recursive: true });

        let finalDestPath = path.join(destDir, fileName);
        let counter = 1;
        const ext = path.extname(fileName);
        const name = path.basename(fileName, ext);

        while (true) {
            try {
                await fs.access(finalDestPath);
                finalDestPath = path.join(destDir, `${name}_${counter}${ext}`);
                counter++;
            } catch { break; }
        }

        await fs.copyFile(sourcePath, finalDestPath);
        await this.handleFileAdd(finalDestPath);

        const id = await this.generateFileId(finalDestPath);
        const asset = this.assetManager.getAsset(id);

        if (!asset) throw new Error('Failed to index ingested file');
        return asset;
    }

    public updateAssetStatus(id: string, status: string) {
        db.prepare('UPDATE assets SET status = ? WHERE id = ?').run(status, id);
    }

    public getLineage(id: string) {
        // Placeholder for lineage
        return [];
    }

    public addComment(assetId: string, text: string, authorId: string) {
        const asset = this.assetManager.getAsset(assetId);
        if (!asset) return;
        const comments = asset.metadata.comments || [];
        comments.push({ id: uuidv4(), text, authorId, timestamp: Date.now() });
        this.updateAssetMetadata(assetId, { ...asset.metadata, comments });
    }

    public updateMetadata(assetId: string, key: string, value: any) {
        const asset = this.assetManager.getAsset(assetId);
        if (!asset) return;
        const metadata = { ...asset.metadata, [key]: value };
        this.updateAssetMetadata(assetId, metadata);
    }

    public updateAssetMetadata(assetId: string, metadata: any) {
        db.prepare('UPDATE assets SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), assetId);
        if (this.mainWindow) {
            const asset = this.assetManager.getAsset(assetId);
            if (asset) this.mainWindow.webContents.send('asset-updated', asset);
        }
    }
}

export const indexerService = new IndexerService();
