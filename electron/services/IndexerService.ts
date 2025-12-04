import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { app, BrowserWindow } from 'electron';
import db, { vectorSearchEnabled } from '../db.js';
import { Asset, SyncStats, AssetMetadata } from '../../src/types.js';
// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';


// import ffmpegPath from 'ffmpeg-static';

import { Scanner } from './indexer/Scanner.js';
import { Watcher } from './indexer/Watcher.js';
import { MetadataExtractor } from './indexer/MetadataExtractor.js';
import { ThumbnailGenerator } from './indexer/ThumbnailGenerator.js';
import { AssetManager } from './indexer/AssetManager.js';
import { embeddingService } from './indexer/EmbeddingService.js';

// Helper to setup ffmpeg
const setupFfmpeg = async () => {
    try {
        // Try to load ffmpeg-static
        // We use a dynamic import to avoid build-time errors if it's missing
        // @ts-ignore
        const ffmpegStatic = (await import('ffmpeg-static')).default;

        if (ffmpegStatic) {
            // Use path.sep for cross-platform compatibility
            const unpackedPath = (ffmpegStatic as unknown as string).replace(
                path.join('app.asar'),
                path.join('app.asar.unpacked')
            );
            ffmpeg.setFfmpegPath(unpackedPath);
            console.log('[IndexerService] Using ffmpeg-static at:', unpackedPath);
        }
    } catch (error) {
        console.warn('[IndexerService] ffmpeg-static not found. Falling back to system ffmpeg.');
        // fluent-ffmpeg will automatically look for 'ffmpeg' in PATH
    }
};

// Initialize ffmpeg immediately
setupFfmpeg();



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
        let realPath = rootPath;
        try {
            realPath = await fs.realpath(rootPath);
        } catch (error) {
            console.warn(`[IndexerService] Failed to resolve real path for ${rootPath}, using original.`, error);
        }

        if (this.rootPath === realPath) {
            console.log(`[IndexerService] Root path already set to ${realPath}. Skipping re-scan.`);
            return;
        }

        this.rootPath = realPath;

        await this.watcher.stop();
        // Watcher will be started after scan completes to avoid race conditions

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

        // 4. Background Embeddings
        this.processEmbeddings();

        this.stats.status = 'idle';
        this.stats.lastSync = Date.now();

        // Re-home assets (handle moves/renames of root)
        this.assetManager.rehomeAssets(this.rootPath);

        // Start watcher AFTER initial scan to avoid double counting
        console.log('[IndexerService] Starting watcher...');
        this.watcher.start(this.rootPath);
    }

    private setupWatcher() {
        this.watcher.on('add', (path: string) => {
            // Only increment if we are not in the initial scanning phase,
            // because preScan already counted the total files.
            if (this.stats.status !== 'scanning') {
                this.stats.totalFiles++;
            }
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
            if ((mediaType === 'video' || mediaType === 'image') && (!thumbnailPath) && !skipThumbnail) {
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

    public async processEmbeddings() {
        if (!vectorSearchEnabled) {
            console.log('[IndexerService] Vector search is disabled. Skipping embedding generation.');
            return;
        }
        console.log(`[IndexerService] Starting embedding generation for rootPath: ${this.rootPath}`);
        const assets = this.assetManager.getAssets(this.rootPath);
        console.log(`[IndexerService] Found ${assets.length} assets in DB for this rootPath.`);

        // Log a few assets to check metadata
        if (assets.length > 0) {
            console.log('[IndexerService] Sample asset metadata:', JSON.stringify(assets[0].metadata));
        }

        const assetsToEmbed = assets.filter(a => !a.metadata.embedding || (Array.isArray(a.metadata.embedding) && a.metadata.embedding.length === 0));

        if (assetsToEmbed.length === 0) {
            console.log('[IndexerService] No embeddings to generate.');
            return;
        }

        // Set status to indexing
        this.stats.status = 'indexing';

        console.log(`[IndexerService] Generating embeddings for ${assetsToEmbed.length} assets...`);
        let current = 0;
        const total = assetsToEmbed.length;

        for (const asset of assetsToEmbed) {
            current++;
            this.stats.currentFile = `Embedding: ${asset.path}`;
            this.stats.embeddingProgress = { current, total };

            try {
                const textToEmbed = [
                    path.basename(asset.path),
                    ...(asset.metadata.tags || []),
                    asset.metadata.description || '',
                    asset.metadata.prompt || '', // GenAI metadata
                    asset.type
                ].join(' ');

                const embedding = await embeddingService.generateEmbedding(textToEmbed);

                if (embedding) {
                    // Update metadata with embedding
                    const newMetadata = { ...asset.metadata, embedding };

                    // 1. Update main assets table
                    this.updateAssetMetadata(asset.id, newMetadata);

                    // 2. Manually update vss_assets table
                    // We do this here instead of triggers to avoid overhead during ingestion
                    // and to prevent concurrency issues.
                    try {
                        const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(asset.id) as { rowid: number };
                        if (row) {
                            db.prepare('DELETE FROM vss_assets WHERE rowid = ?').run(row.rowid);
                            db.prepare('INSERT INTO vss_assets(rowid, embedding) VALUES (?, ?)').run(row.rowid, JSON.stringify(embedding));
                        }
                    } catch (vssError) {
                        console.error(`[IndexerService] Failed to update vss_assets for ${asset.id}:`, vssError);
                    }

                    this.stats.embeddingsGenerated = (this.stats.embeddingsGenerated || 0) + 1;
                }
            } catch (error) {
                console.error(`[IndexerService] Failed to generate embedding for ${asset.path}:`, error);
            }

            // Yield to event loop occasionally
            if (current % 10 === 0) await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log('[IndexerService] Embedding generation complete.');
        this.stats.currentFile = undefined;
        this.stats.embeddingProgress = undefined;
        // Status will be reset to idle by the caller (setRootPath) or we can set it here if called independently
        // But since setRootPath sets it to idle at the end, we don't strictly need to set it here if called from there.
        // However, if called independently, we might want to reset it.
        // For safety, let's leave it to the caller or set to idle if we are sure?
        // setRootPath calls this, then sets to idle.
        // If we set to idle here, it's fine.
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
            skippedFiles: 0,
            embeddingsGenerated: 0,
            embeddingProgress: undefined
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

    public async findSimilar(assetId: string, limit: number = 20): Promise<Asset[]> {
        if (!vectorSearchEnabled) return [];
        const asset = this.assetManager.getAsset(assetId);
        if (!asset || !asset.metadata.embedding) return [];

        try {
            const embedding = JSON.stringify(asset.metadata.embedding);

            const stmt = db.prepare(`
                WITH matches AS (
                    SELECT rowid, distance 
                    FROM vss_assets 
                    WHERE vss_search(embedding, ?)
                    LIMIT ?
                )
                SELECT a.*, m.distance 
                FROM matches m
                JOIN assets a ON a.rowid = m.rowid
                WHERE a.id != ? -- Exclude self
                ORDER BY m.distance ASC
            `);

            const results = stmt.all(embedding, limit + 1, assetId) as any[];

            return results.map(row => ({
                ...row,
                metadata: JSON.parse(row.metadata)
            }));
        } catch (error) {
            console.error('[IndexerService] findSimilar failed:', error);
            return [];
        }
    }

    // Search Assets (Kept in IndexerService for now to ensure compatibility)
    public async searchAssets(searchQuery: string, filters?: any): Promise<Asset[]> {
        let sql = `SELECT DISTINCT a.* FROM assets a`;
        const params: any = { rootPath: this.rootPath };
        const conditions: string[] = ['a.rootPath = @rootPath'];

        if (searchQuery && searchQuery.trim() !== '') {
            if (filters?.semantic) {
                // Semantic Search
                try {
                    // Generate embedding for query
                    // Note: This is async, but searchAssets is sync in current signature?
                    // Wait, searchAssets return type is Asset[]. It should probably be async now.
                    // But for now, we can't easily make it async without changing the interface everywhere.
                    // Actually, we can't do async inside this sync method.
                    // We need to change searchAssets to async or use a separate method.
                    // Given the constraints, let's assume we only do keyword search here for now,
                    // and use findSimilar for vector search.
                    // OR: We can try to do it if we change the signature.
                    // Let's stick to FTS here for "search" and use a new method for semantic search if needed.

                    // Fallback to FTS
                    sql += ` JOIN assets_fts ON assets_fts.id = a.id`;
                    conditions.push(`assets_fts MATCH @searchQuery`);
                    params.searchQuery = searchQuery.split(' ').map(term => term + '*').join(' ');
                } catch (e) {
                    console.error('Semantic search error:', e);
                }
            } else {
                // Standard FTS
                sql += ` JOIN assets_fts ON assets_fts.id = a.id`;
                conditions.push(`assets_fts MATCH @searchQuery`);
                params.searchQuery = searchQuery.split(' ').map(term => term + '*').join(' ');
            }
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
            if (filters.semantic) {
                // Use vector search
                const similarAssets = await this.findSimilar(filters.relatedToAssetId, 50);
                // We might want to filter these results further by other criteria?
                // For now, let's just return them, maybe filtering by other criteria in memory if needed.
                // But wait, findSimilar returns Asset[].
                // If we want to combine with other SQL filters, it's tricky because findSimilar uses vss_search which is a virtual table.
                // The best way is to get IDs from findSimilar and then filter by other criteria in SQL.

                if (similarAssets.length === 0) return [];

                const similarIds = similarAssets.map(a => a.id);
                conditions.push(`a.id IN (${similarIds.map((_, i) => `@simId${i}`).join(',')})`);
                similarIds.forEach((id, i) => { params[`simId${i}`] = id; });

                // We also want to preserve the order from findSimilar (distance)
                // We can do this by using a CASE statement in ORDER BY or just sorting in JS.
                // Sorting in JS is easier since we already have the distance in similarAssets (if we kept it).
                // But searchAssets returns Asset[], and we lose the distance unless we attach it.
                // Let's rely on the fact that we are filtering by IDs.
                // But SQL won't preserve order of IN clause.
                // So we should probably return here if we want strict similarity order, 
                // OR we can attach the distance to the assets and sort after SQL query.

                // Let's do the ID filter approach so other filters (type, status) still work.
            } else {
                // Exact match on inputs (lineage)
                conditions.push(`EXISTS (SELECT 1 FROM json_each(a.metadata, '$.inputs') WHERE json_each.value = @relatedToAssetId)`);
                params.relatedToAssetId = filters.relatedToAssetId;
            }
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
        let assets = stmt.all(params).map((row: any) => ({
            ...row,
            metadata: JSON.parse(row.metadata)
        }));

        // If semantic search for related assets, sort by the order of IDs returned by findSimilar
        if (filters?.relatedToAssetId && filters.semantic && assets.length > 0) {
            // We need to re-fetch the similar IDs to get the order, or we could have passed them in.
            // Since we didn't pass them in, let's just re-sort based on the input IDs order if possible.
            // But wait, we don't have the input IDs here easily without re-running findSimilar or passing them.
            // Actually, we constructed the SQL with `IN (@simId0, @simId1...)`.
            // We can reconstruct the order from the params.

            const similarIds: string[] = [];
            let i = 0;
            while (params[`simId${i}`]) {
                similarIds.push(params[`simId${i}`]);
                i++;
            }

            if (similarIds.length > 0) {
                const idMap = new Map(similarIds.map((id, index) => [id, index]));
                assets.sort((a: any, b: any) => {
                    const indexA = idMap.get(a.id) ?? Infinity;
                    const indexB = idMap.get(b.id) ?? Infinity;
                    return indexA - indexB;
                });
            }
        }

        // If we have a relatedToAssetId, ensure that asset is included and at the top
        if (filters?.relatedToAssetId) {
            const sourceAsset = this.assetManager.getAsset(filters.relatedToAssetId);
            if (sourceAsset) {
                // Remove source asset if it's already in the results
                assets = assets.filter((a: any) => a.id !== filters.relatedToAssetId);

                // Prepend source asset
                // We need to fetch tags for it too if we are doing that below
                // But let's just add it to the list and let the tag fetching logic handle it if possible
                // The tag fetching logic uses `assets.map(a => a.id)`, so if we add it here, it will get tags.
                assets.unshift(sourceAsset as any);
            }
        }

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

    public getLineage(id: string): Asset[] {
        const assets = new Map<string, Asset>();
        const visited = new Set<string>();

        // Helper to get asset by ID (synchronous since we have in-memory map)
        const getAsset = (assetId: string) => this.assetManager.getAsset(assetId);

        // Queue for BFS
        const queue: string[] = [id];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const asset = getAsset(currentId);
            if (!asset) continue;

            assets.set(asset.id, asset);

            // 1. Traverse Up (Ancestors) - inputs
            if (asset.metadata.inputs) {
                for (const inputId of asset.metadata.inputs) {
                    if (!visited.has(inputId)) {
                        queue.push(inputId);
                    }
                }
            }

            // 2. Traverse Down (Descendants) - assets that have this as input
            // This is expensive if we iterate all assets every time.
            // Ideally we'd have a reverse index. For now, we'll iterate all assets once to build a map?
            // Or just iterate all assets for the current node?
            // Let's iterate all assets to find children.
            // Optimization: Build a reverse index on startup/update?
            // For now, simple iteration.
            const allAssets = this.assetManager.getAssets(this.rootPath);
            for (const otherAsset of allAssets) {
                if (otherAsset.metadata.inputs?.includes(currentId)) {
                    if (!visited.has(otherAsset.id)) {
                        queue.push(otherAsset.id);
                    }
                }
            }
        }

        return Array.from(assets.values());
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

    public updateAssetMetadata(id: string, metadata: any) {
        db.prepare('UPDATE assets SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), id);

        // Manual FTS Update
        const row = db.prepare('SELECT rowid, path FROM assets WHERE id = ?').get(id) as { rowid: number, path: string };
        if (row) {
            db.prepare('DELETE FROM assets_fts WHERE rowid = ?').run(row.rowid);
            db.prepare('INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (?, ?, ?, ?)').run(row.rowid, id, row.path, JSON.stringify(metadata));
        }
        if (this.mainWindow) {
            const asset = this.assetManager.getAsset(id);
            if (asset) this.mainWindow.webContents.send('asset-updated', asset);
        }
    }
}

export const indexerService = new IndexerService();
