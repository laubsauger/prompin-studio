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
import { SyncService, SyncEvent } from './SyncService.js';
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
    private syncService: SyncService;
    private isApplyingRemoteUpdate = false;

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
        this.syncService = new SyncService();

        this.setupWatcher();
        this.setupSync();
        this.migrateLegacyThumbnails();
    }

    private setupSync() {
        this.syncService.on('event', async (event: SyncEvent) => {
            console.log('[IndexerService] Received remote event:', event.type);
            this.isApplyingRemoteUpdate = true;
            this.stats.status = 'syncing';
            try {
                switch (event.type) {
                    case 'ASSET_UPDATE':
                        await this.handleRemoteAssetUpdate(event.payload);
                        break;
                    case 'TAG_CREATE':
                        await this.handleRemoteTagCreate(event.payload);
                        break;
                    case 'ASSET_TAG_ADD':
                        await this.handleRemoteAssetTagAdd(event.payload);
                        break;
                    case 'ASSET_TAG_REMOVE':
                        await this.handleRemoteAssetTagRemove(event.payload);
                        break;
                }
            } catch (error) {
                console.error('[IndexerService] Failed to apply remote event:', error);
            } finally {
                this.isApplyingRemoteUpdate = false;
                this.stats.status = 'idle';
                this.stats.lastSync = Date.now();
            }
        });
    }

    private async handleRemoteAssetUpdate(payload: { assetId: string; changes: any }) {
        const { assetId, changes } = payload;
        if (changes.status) {
            this.updateAssetStatus(assetId, changes.status);
        }
        if (changes.metadata) {
            const asset = this.assetManager.getAsset(assetId);
            if (asset) {
                const newMetadata = { ...asset.metadata, ...changes.metadata };
                this.updateAssetMetadata(assetId, newMetadata);
            }
        }
    }

    private async handleRemoteTagCreate(payload: { tag: any }) {
        this.createTag(payload.tag.name, payload.tag.color);
    }

    private async handleRemoteAssetTagAdd(payload: { assetId: string; tagId: string }) {
        this.addTagToAsset(payload.assetId, payload.tagId);
    }

    private async handleRemoteAssetTagRemove(payload: { assetId: string; tagId: string }) {
        this.removeTagFromAsset(payload.assetId, payload.tagId);
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    public getRootPath(): string {
        return this.rootPath;
    }

    private initializeStatsFromDB() {
        try {
            console.log(`[IndexerService] Initializing stats from DB for rootPath: '${this.rootPath}'`);
            const totalCount = db.prepare('SELECT COUNT(*) as count FROM assets WHERE rootPath = ?').get(this.rootPath) as { count: number };
            console.log(`[IndexerService] DB Count for rootPath: ${totalCount.count}`);

            // Debug: Check if there are ANY assets and what their rootPaths are
            if (totalCount.count === 0) {
                const anyAsset = db.prepare('SELECT rootPath FROM assets LIMIT 1').get() as { rootPath: string };
                if (anyAsset) {
                    console.log(`[IndexerService] Found asset with rootPath: '${anyAsset.rootPath}' (Expected: '${this.rootPath}')`);
                } else {
                    console.log('[IndexerService] DB is completely empty.');
                }
            }

            const imageCount = db.prepare('SELECT COUNT(*) as count FROM assets WHERE rootPath = ? AND type = "image"').get(this.rootPath) as { count: number };
            const videoCount = db.prepare('SELECT COUNT(*) as count FROM assets WHERE rootPath = ? AND type = "video"').get(this.rootPath) as { count: number };
            const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders').get() as { count: number };

            this.stats.totalFiles = totalCount.count;
            this.stats.processedFiles = totalCount.count;

            if (!this.stats.filesByType) {
                this.stats.filesByType = { images: 0, videos: 0, other: 0 };
            }
            this.stats.filesByType.images = imageCount.count;
            this.stats.filesByType.videos = videoCount.count;
            this.stats.filesByType.other = totalCount.count - imageCount.count - videoCount.count;
            this.stats.totalFolders = folderCount.count;

            console.log(`[IndexerService] Initialized stats from DB: ${this.stats.totalFiles} files (${this.stats.filesByType.images} images, ${this.stats.filesByType.videos} videos), ${this.stats.totalFolders} folders.`);
        } catch (error) {
            console.error('[IndexerService] Failed to initialize stats from DB:', error);
        }
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
            // Ensure stats are populated even if we skip scan
            if (this.stats.totalFiles === 0) {
                this.initializeStatsFromDB();
            }
            return;
        }

        this.rootPath = realPath;

        await this.watcher.stop();
        // Watcher will be started after scan completes to avoid race conditions

        this.resetStats();
        // Initialize totalFiles from DB so UI shows something immediately
        this.initializeStatsFromDB();

        this.stats.status = 'scanning';

        // Initialize Sync Service
        await this.syncService.initialize(this.rootPath);

        // 3. Process Embeddings (Sync)
        console.log('[IndexerService] Processing embeddings...');
        this.scanner.resetStats();
        await this.scanner.preScan(this.rootPath);
        const scanStats = this.scanner.getStats();
        this.stats.totalFiles = scanStats.totalFiles;
        this.stats.totalFolders = scanStats.totalFolders;

        // 1. Fast Pre-Scan
        console.log('[IndexerService] Starting fast pre-scan...');
        this.scanner.resetStats();
        await this.scanner.preScan(this.rootPath);
        // const scanStats = this.scanner.getStats(); // Already done above, but keeping for original flow
        this.stats.totalFiles = scanStats.totalFiles;
        this.stats.totalFolders = scanStats.totalFolders;
        this.stats.skippedFiles = scanStats.skippedFiles;
        this.stats.filesByType = {
            images: scanStats.images,
            videos: scanStats.videos,
            other: scanStats.other
        };
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

        // Initialize Sync Service
        await this.syncService.initialize(this.rootPath);

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
        this.stats.processedFiles++;

        const mediaType = this.getMediaType(filePath);
        if (mediaType === 'image') this.stats.filesByType!.images++;
        else if (mediaType === 'video') this.stats.filesByType!.videos++;
        else this.stats.filesByType!.other++;

        try {
            // Note: If filePath is a symlink, fs.stat gets stats of the target.
            // But we want to index it as if it's at filePath.
            const stats = await fs.stat(filePath);
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
        this.stats.backgroundTask = {
            name: 'Generating Thumbnails',
            total: assets.length,
            current: 0,
            progress: 0
        };

        await this.thumbnailGenerator.processQueue(
            assets,
            this.rootPath,
            (progress: { current: number; total: number }, currentFile: string) => {
                this.stats.thumbnailProgress = progress;
                this.stats.currentFile = currentFile;
                if (this.stats.backgroundTask) {
                    this.stats.backgroundTask.current = progress.current;
                    this.stats.backgroundTask.total = progress.total;
                    this.stats.backgroundTask.progress = (progress.current / progress.total) * 100;
                }
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
        this.stats.backgroundTask = undefined;
    }

    public async processEmbeddings() {
        if (!vectorSearchEnabled) {
            console.log('[IndexerService] Vector search is disabled. Skipping embedding generation.');
            return;
        }
        console.log(`[IndexerService] Starting embedding generation for rootPath: ${this.rootPath}`);
        const assets = this.assetManager.getAssets(this.rootPath);
        console.log(`[IndexerService] Found ${assets.length} assets in DB for this rootPath.`);

        // 1. Identify assets that have embeddings but might be missing from vec_assets (Sync Step)
        const assetsWithEmbeddings = assets.filter(a => a.metadata.embedding && Array.isArray(a.metadata.embedding) && a.metadata.embedding.length > 0);

        if (assetsWithEmbeddings.length > 0) {
            console.log(`[IndexerService] Checking ${assetsWithEmbeddings.length} assets for vec_assets sync...`);
            let syncedCount = 0;

            // Get all rowids currently in vec_assets
            // Note: This might be heavy if millions of rows, but fine for thousands.
            // For larger datasets, we should do this in chunks or using a LEFT JOIN query.
            try {
                const vecRows = db.prepare('SELECT rowid FROM vec_assets').all() as { rowid: number | bigint }[];
                const vecRowIds = new Set(vecRows.map(r => BigInt(r.rowid).toString())); // Use string for reliable Set comparison with BigInt

                for (const asset of assetsWithEmbeddings) {
                    const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(asset.id) as { rowid: number | bigint };
                    if (row) {
                        const rowId = BigInt(row.rowid);
                        if (!vecRowIds.has(rowId.toString())) {
                            // Missing from vec_assets, re-insert
                            try {
                                db.prepare('INSERT INTO vec_assets(rowid, embedding) VALUES (?, ?)').run(rowId, JSON.stringify(asset.metadata.embedding));
                                syncedCount++;
                            } catch (e) {
                                console.error(`[IndexerService] Failed to sync vec_assets for ${asset.id}:`, e);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[IndexerService] Error during vec_assets sync check:', e);
            }

            if (syncedCount > 0) {
                console.log(`[IndexerService] Synced ${syncedCount} assets to vec_assets table.`);
            } else {
                console.log('[IndexerService] vec_assets table is in sync.');
            }
        }

        // 2. Identify assets that need new embeddings
        const assetsToEmbed = assets.filter(a => !a.metadata.embedding || (Array.isArray(a.metadata.embedding) && a.metadata.embedding.length === 0));

        if (assetsToEmbed.length === 0) {
            console.log('[IndexerService] No new embeddings to generate.');
            return;
        }

        // Set status to indexing
        // Set status to indexing
        this.stats.status = 'indexing';
        this.stats.backgroundTask = {
            name: 'Generating Embeddings',
            total: assetsToEmbed.length,
            current: 0,
            progress: 0
        };

        console.log(`[IndexerService] Generating embeddings for ${assetsToEmbed.length} assets...`);
        let current = 0;
        const total = assetsToEmbed.length;

        for (const asset of assetsToEmbed) {
            current++;
            this.stats.currentFile = `Embedding: ${asset.path}`;
            this.stats.embeddingProgress = { current, total };
            if (this.stats.backgroundTask) {
                this.stats.backgroundTask.current = current;
                this.stats.backgroundTask.progress = (current / total) * 100;
            }

            try {
                // Check if the actual asset file exists
                const absoluteAssetPath = path.join(this.rootPath, asset.path);
                try {
                    await fs.access(absoluteAssetPath);
                } catch (e: any) {
                    if (e.code === 'ENOENT') {
                        console.warn(`[IndexerService] Asset file missing, removing from DB: ${absoluteAssetPath}`);
                        this.assetManager.deleteAsset(asset.id);
                        continue;
                    }
                    throw e; // Rethrow other errors
                }

                // Determine input for embedding (Image/Thumbnail or Text)
                let inputForEmbedding: string;

                if (asset.type === 'image') {
                    // For images, use the full image path
                    inputForEmbedding = path.join(this.rootPath, asset.path);
                } else if (asset.type === 'video' && asset.thumbnailPath) {
                    // For videos, use the thumbnail path if available
                    if (path.isAbsolute(asset.thumbnailPath)) {
                        inputForEmbedding = asset.thumbnailPath;
                    } else {
                        // Check if it's in the thumbnail cache first (generated thumbnails)
                        const cachedThumbnail = path.join(this.thumbnailCachePath, asset.thumbnailPath);
                        try {
                            await fs.access(cachedThumbnail);
                            inputForEmbedding = cachedThumbnail;
                        } catch {
                            // Fallback to rootPath (maybe user provided a custom relative path?)
                            inputForEmbedding = path.join(this.rootPath, asset.thumbnailPath);
                        }
                    }
                } else {
                    // Fallback to text metadata
                    inputForEmbedding = [
                        path.basename(asset.path),
                        ...(asset.metadata.tags || []),
                        asset.metadata.description || '',
                        asset.metadata.prompt || '', // GenAI metadata
                        asset.type
                    ].join(' ');
                }

                const embedding = await embeddingService.generateEmbedding(inputForEmbedding);

                if (embedding) {
                    // Update metadata with embedding
                    const newMetadata = { ...asset.metadata, embedding };

                    // 1. Update main assets table
                    this.updateAssetMetadata(asset.id, newMetadata);

                    // 2. Manually update vec_assets table
                    try {
                        const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(asset.id) as { rowid: number | bigint };
                        if (row) {
                            // Ensure rowid is passed as a BigInt to guarantee INTEGER binding for sqlite-vec
                            const rowId = BigInt(row.rowid);
                            db.prepare('DELETE FROM vec_assets WHERE rowid = ?').run(rowId);
                            db.prepare('INSERT INTO vec_assets(rowid, embedding) VALUES (?, ?)').run(rowId, JSON.stringify(embedding));
                        }
                    } catch (vecError) {
                        console.error(`[IndexerService] Failed to update vec_assets for ${asset.id}:`, vecError);
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
        this.stats.backgroundTask = undefined;
        this.stats.status = 'idle';
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
            embeddingProgress: undefined,
            backgroundTask: undefined
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
                    FROM vec_assets 
                    WHERE embedding MATCH ?
                    ORDER BY distance
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
        let similarAssetsMap: Map<string, number> | undefined;
        const params: any = { rootPath: this.rootPath };
        const conditions: string[] = ['a.rootPath = @rootPath'];

        // 1. FTS Search
        if (searchQuery && searchQuery.trim() !== '') {
            // Standard FTS setup
            sql += ` JOIN assets_fts ON assets_fts.id = a.id`;
            conditions.push(`assets_fts MATCH @searchQuery`);
            params.searchQuery = searchQuery.split(' ').map(term => term + '*').join(' ');
        }

        // Apply filters to FTS query
        if (filters?.tagIds && filters.tagIds.length > 0) {
            conditions.push(`EXISTS (SELECT 1 FROM asset_tags at WHERE at.assetId = a.id AND at.tagId IN (${filters.tagIds.map((_: any, i: number) => `@tagId${i}`).join(',')}))`);
            filters.tagIds.forEach((tagId: string, i: number) => { params[`tagId${i}`] = tagId; });
        }
        if (filters?.ids && filters.ids.length > 0) {
            conditions.push(`a.id IN (${filters.ids.map((_: any, i: number) => `@id${i}`).join(',')})`);
            filters.ids.forEach((id: string, i: number) => { params[`id${i}`] = id; });
        }
        // ... (other filters are applied below in the original code)

        // We need to capture the "base" conditions for the vector query too if we want to filter vector results.
        // But vector search with complex SQL filters is hard in sqlite-vec (pre-filtering vs post-filtering).
        // Post-filtering is easier: Get top N vector matches, then filter in JS or join.

        // Let's proceed with running the FTS query first (which includes all filters).
        // Then, if searchQuery is present and vector enabled, run vector search.

        // Wait, the original code constructs `sql` and `conditions` then runs `db.prepare(sql)`.
        // I should let the original code run for FTS.
        // But I need to inject the Vector logic.

        // Let's change the structure:
        // 1. Build FTS Query (mostly existing code)
        // 2. Run FTS Query -> `ftsAssets`
        // 3. If searchQuery, Run Vector Query -> `vectorAssets`
        // 4. Merge

        // But the existing code applies filters to `sql`.
        // I'll leave the existing code to build and run the FTS query.
        // I will just ADD the vector search logic AFTER the FTS query execution, then merge.
        // But `searchAssets` returns `Promise<Asset[]>`.

        // The existing code executes the query at line 759: `const stmt = db.prepare(sql); let assets = ...`

        // So I should modify the code *around* line 759, or wrap the whole thing.
        // But I am editing lines 661-689.

        // I will remove the `if (filters?.semantic)` block and just setup FTS here.
        // Then I will add the Vector Search logic LATER in the function (I'll need another edit for that).
        // OR I can do it all here if I restructure.

        // Let's just simplify this block to ALWAYS do FTS setup.
        // And I'll add a TODO or just rely on the fact that I'll edit the execution part next.

        // Actually, if I want to do Hybrid, I need to NOT join assets_fts if I'm doing *only* vector? 
        // No, Hybrid means both.

        // So this block should just setup FTS.
        // I will remove the "Semantic Search" try-catch block that was falling back to FTS anyway.

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
            if (filters.semantic) {
                // Use vector search
                const similarAssets = await this.findSimilar(filters.relatedToAssetId, 50);
                // We might want to filter these results further by other criteria?
                // For now, let's just return them, maybe filtering by other criteria in memory if needed.
                // But wait, findSimilar returns Asset[].
                // If we want to combine with other SQL filters, it's tricky because findSimilar uses vec_assets which is a virtual table.
                // The best way is to get IDs from findSimilar and then filter by other criteria in SQL.

                if (similarAssets.length === 0) return [];

                similarAssetsMap = new Map(similarAssets.map(a => [a.id, (a as any).distance]));

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

        // Hybrid Search: If we have a search query and vector search is enabled,
        // fetch visually similar assets and append them.
        if (searchQuery && searchQuery.trim() !== '' && vectorSearchEnabled) {
            try {
                // 1. Generate embedding for the search query
                const embedding = await embeddingService.generateEmbedding(searchQuery);

                if (embedding) {
                    console.log(`[IndexerService] Generated query embedding. Preview: [${embedding.slice(0, 5).join(', ')}...]`);

                    // 2. Query vec_assets for top matches
                    const vectorLimit = 50;
                    const vectorStmt = db.prepare(`
                        WITH matches AS (
                            SELECT rowid, distance 
                            FROM vec_assets 
                            WHERE embedding MATCH ?
                            ORDER BY distance
                            LIMIT ?
                        )
                        SELECT a.*, m.distance 
                        FROM matches m
                        JOIN assets a ON a.rowid = m.rowid
                        ORDER BY m.distance ASC
                    `);

                    const vectorResults = vectorStmt.all(JSON.stringify(embedding), vectorLimit).map((row: any) => ({
                        ...row,
                        metadata: JSON.parse(row.metadata)
                    }));

                    console.log(`[IndexerService] Vector search returned ${vectorResults.length} raw matches.`);
                    if (vectorResults.length > 0) {
                        console.log(`[IndexerService] Top match: ${vectorResults[0].id} (dist: ${(vectorResults[0] as any).distance})`);
                    }

                    // 3. Merge results
                    // Strategy: Keep all FTS results (they are exact matches).
                    // Append Vector results that are NOT in FTS results.
                    const existingIds = new Set(assets.map((a: any) => a.id));

                    for (const vecAsset of vectorResults) {
                        if (!existingIds.has(vecAsset.id)) {
                            // Apply other filters to vector results if needed?
                            // For now, we'll just do a basic check for type/status if they are simple.
                            // Implementing full SQL filter parity in JS is hard.
                            // Let's just check the most common ones: type, status.

                            let pass = true;
                            if (filters?.type && vecAsset.type !== filters.type) pass = false;
                            if (filters?.status && vecAsset.status !== filters.status) pass = false;

                            if (pass) {
                                assets.push(vecAsset);
                                existingIds.add(vecAsset.id);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[IndexerService] Hybrid search vector query failed:', e);
            }
        }

        // If semantic search for related assets, sort by distance
        if (filters?.relatedToAssetId && filters.semantic && assets.length > 0 && similarAssetsMap) {
            assets.sort((a: any, b: any) => {
                const distA = similarAssetsMap!.get(a.id) ?? Infinity;
                const distB = similarAssetsMap!.get(b.id) ?? Infinity;
                return distA - distB; // Ascending distance = Descending similarity
            });
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
                const sourceWithDistance = { ...sourceAsset, distance: 0 }; // Source always has 0 distance to itself
                assets.unshift(sourceWithDistance as any);
            }
        }

        if (filters?.relatedToAssetId && filters.semantic && similarAssetsMap) {
            // Debug logging removed
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

            return assets.map((asset: any) => {
                // Attach distance if available (from semantic search)
                let distance = asset.distance;
                if (filters?.relatedToAssetId && filters.semantic && similarAssetsMap) {
                    const assetId = asset.id as string;
                    const mappedDistance = similarAssetsMap.get(assetId);
                    if (mappedDistance !== undefined) {
                        distance = mappedDistance;
                    }
                    // console.log(`[IndexerService] Mapping distance for ${assetId}: ${distance}`);
                }

                return {
                    ...asset,
                    tags: tagsByAsset[asset.id] || [],
                    distance
                };
            }).filter(asset => {
                // If semantic search is active, only return assets with a valid distance
                if (filters?.relatedToAssetId && filters.semantic) {
                    return asset.distance !== undefined;
                }
                return true;
            });
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
            if (!this.isApplyingRemoteUpdate) {
                this.syncService.publish('TAG_CREATE', { tag: { id, name, color } });
            }
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
        if (!this.isApplyingRemoteUpdate) {
            this.syncService.publish('ASSET_TAG_ADD', { assetId, tagId });
        }
    }

    public removeTagFromAsset(assetId: string, tagId: string) {
        db.prepare('DELETE FROM asset_tags WHERE assetId = ? AND tagId = ?').run(assetId, tagId);
        if (!this.isApplyingRemoteUpdate) {
            this.syncService.publish('ASSET_TAG_REMOVE', { assetId, tagId });
        }
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
        if (!this.isApplyingRemoteUpdate) {
            this.syncService.publish('ASSET_UPDATE', { assetId: id, changes: { status } });
        }
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

        if (!this.isApplyingRemoteUpdate) {
            // Filter out embedding to avoid syncing huge blobs
            const { embedding, ...syncMetadata } = metadata;
            this.syncService.publish('ASSET_UPDATE', { assetId: id, changes: { metadata: syncMetadata } });
        }

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
    async handleChatMessage(text: string) {
        try {
            console.log(`[IndexerService] Handling chat message: "${text}"`);

            // For now, treat everything as a search query
            // We limit to top 4 results for the chat view
            const results = await this.searchAssets(text, { semantic: true });
            const topResults = results.slice(0, 4);

            if (topResults.length > 0) {
                return {
                    type: 'search_results',
                    message: `I found ${results.length} assets. Here are the top matches:`,
                    assets: topResults
                };
            } else {
                return {
                    type: 'chat',
                    message: `I couldn't find any assets matching "${text}".`
                };
            }

        } catch (error) {
            console.error('[IndexerService] Error handling chat message:', error);
            return { type: 'error', message: 'I encountered an error while searching.' };
        }
    }
}

export const indexerService = new IndexerService();

