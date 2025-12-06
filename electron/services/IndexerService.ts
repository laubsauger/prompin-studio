import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import electron, { BrowserWindow as BrowserWindowType } from 'electron';
import db, { vectorSearchEnabled } from '../db.js';

const { app, BrowserWindow } = electron;
import { Asset, SyncStats, AssetMetadata } from '../../src/types.js';
// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';


// import ffmpegPath from 'ffmpeg-static';

import { Scanner } from './indexer/Scanner.js';
import { Watcher } from './indexer/Watcher.js';
import { MetadataExtractor } from './indexer/MetadataExtractor.js';
import { ThumbnailGenerator } from './indexer/ThumbnailGenerator.js';
import { AssetManager } from './AssetManager.js';
import { SyncService, SyncEvent } from './SyncService.js';
import { embeddingService } from './indexer/EmbeddingService.js';
import { searchService } from './SearchService.js';
import { tagService } from './TagService.js';
import { folderService } from './FolderService.js';
import { assetService } from './AssetService.js';
import { analyticsService } from './AnalyticsService.js';

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
    private mainWindow: BrowserWindowType | null = null;

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
        // Default to userData until rootPath is set
        this.thumbnailCachePath = path.join(app.getPath('userData'), 'thumbnails');

        this.scanner = new Scanner(this.isMediaFile.bind(this));
        this.watcher = new Watcher();
        this.metadataExtractor = new MetadataExtractor();
        this.thumbnailGenerator = new ThumbnailGenerator(this.thumbnailCachePath);
        this.assetManager = new AssetManager();
        this.syncService = new SyncService();

        this.setupWatcher();
        this.setupSync();
    }

    private setupSync() {
        this.syncService.on('event', async (event: SyncEvent) => {
            //console.log('[IndexerService] Received remote event:', event.type);
            this.isApplyingRemoteUpdate = true;
            this.stats.status = 'syncing';
            try {
                switch (event.type) {
                    case 'ASSET_UPDATE':
                        await this.handleRemoteAssetUpdate(event.payload);
                        break;
                    case 'TAG_CREATE':
                        // Delegate to TagService
                        tagService.createTag(event.payload.tag.name, event.payload.tag.color, true);
                        break;
                    case 'ASSET_TAG_ADD':
                        // Delegate to TagService
                        tagService.addTagToAsset(event.payload.assetId, event.payload.tagId, true);
                        break;
                    case 'ASSET_TAG_REMOVE':
                        // Delegate to TagService
                        tagService.removeTagFromAsset(event.payload.assetId, event.payload.tagId, true);
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
            assetService.updateAssetStatus(assetId, changes.status, true);
        }
        if (changes.metadata) {
            const asset = this.assetManager.getAsset(assetId);
            if (asset) {
                const newMetadata = { ...asset.metadata, ...changes.metadata };
                assetService.updateAssetMetadata(assetId, newMetadata, true);
            }
        }
    }



    public setMainWindow(window: BrowserWindowType) {
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

            const imageCount = db.prepare("SELECT COUNT(*) as count FROM assets WHERE rootPath = ? AND type = 'image'").get(this.rootPath) as { count: number };
            const videoCount = db.prepare("SELECT COUNT(*) as count FROM assets WHERE rootPath = ? AND type = 'video'").get(this.rootPath) as { count: number };
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
            // Ensure services are aware of the root path (in case of service restart/re-init)
            assetService.setRootPath(this.rootPath);
            searchService.setRootPath(this.rootPath);
            folderService.setRootPath(this.rootPath);

            // Ensure stats are populated even if we skip scan
            if (this.stats.totalFiles === 0) {
                this.initializeStatsFromDB();
            }
            return;
        }

        this.rootPath = realPath;
        this.stats.status = 'scanning'; // Set status immediately

        // Propagate to services IMMEDIATELY so they can serve existing data while we migrate/scan
        assetService.setRootPath(this.rootPath);
        searchService.setRootPath(this.rootPath);
        folderService.setRootPath(this.rootPath);

        // Update thumbnail path to be portable
        this.thumbnailCachePath = path.join(this.rootPath, '.prompin-studio', 'thumbnails');
        await fs.mkdir(this.thumbnailCachePath, { recursive: true });

        // Pass legacy path for lazy migration
        const legacyPath = path.join(app.getPath('userData'), 'thumbnails');
        this.thumbnailGenerator = new ThumbnailGenerator(this.thumbnailCachePath, legacyPath);

        await this.watcher.stop();
        // Watcher will be started after scan completes to avoid race conditions

        this.resetStats();
        // Initialize totalFiles from DB so UI shows something immediately
        this.initializeStatsFromDB();

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
        // Reset processedFiles to avoid double counting from initializeStatsFromDB
        this.stats.processedFiles = 0;

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

        // Normalize path to always use forward slashes for cross-platform compatibility
        const relativePath = path.relative(this.rootPath, filePath).replace(/\\/g, '/');
        this.stats.currentFile = relativePath;
        this.stats.processedFiles++;

        const mediaType = this.getMediaType(filePath);
        // Only update stats if we are not in the initial scanning phase
        // (preScan already counted everything)
        if (this.stats.status !== 'scanning') {
            if (mediaType === 'image') this.stats.filesByType!.images++;
            else if (mediaType === 'video') this.stats.filesByType!.videos++;
            else this.stats.filesByType!.other++;
        }

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

            // Inside handleFileAdd method
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

            const isNew = !existing;
            this.assetManager.upsertAsset(asset);

            if (isNew) {
                analyticsService.logEvent(id, 'create', undefined, undefined, undefined);
            }

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

        // Ensure shared embeddings directory exists
        const embeddingsDir = path.join(this.rootPath, '.prompin-studio', 'embeddings');
        await fs.mkdir(embeddingsDir, { recursive: true });

        // 1. Identify assets that have VALID (512-dim) embeddings for vec_assets sync
        const assetsWithEmbeddings = assets.filter(a => a.metadata.embedding && Array.isArray(a.metadata.embedding) && a.metadata.embedding.length === 512);

        if (assetsWithEmbeddings.length > 0) {
            console.log(`[IndexerService] Checking ${assetsWithEmbeddings.length} assets for vec_assets sync...`);
            let syncedCount = 0;

            // Get all rowids currently in vec_assets
            try {
                const vecRows = db.prepare('SELECT rowid FROM vec_assets').all() as { rowid: number | bigint }[];
                const vecRowIds = new Set(vecRows.map(r => BigInt(r.rowid).toString()));

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

        // 2. Identify assets that need new embeddings (missing OR wrong dimension)
        const assetsToEmbed = assets.filter(a => !a.metadata.embedding || (Array.isArray(a.metadata.embedding) && a.metadata.embedding.length !== 512));

        if (assetsToEmbed.length === 0) {
            console.log('[IndexerService] No new embeddings to generate.');
            return;
        }

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
                    throw e;
                }

                // Check for SHARED embedding file first
                const sharedEmbeddingPath = path.join(embeddingsDir, `${asset.id}.json`);
                let embedding: number[] | null = null;

                try {
                    const sharedContent = await fs.readFile(sharedEmbeddingPath, 'utf-8');
                    const sharedData = JSON.parse(sharedContent);
                    if (Array.isArray(sharedData) && sharedData.length === 512) {
                        embedding = sharedData;
                        console.log(`[IndexerService] Loaded shared embedding for ${asset.id}`);
                    }
                } catch (e) {
                    // File doesn't exist or is invalid, proceed to generate
                }

                if (!embedding) {
                    // Generate new embedding
                    let inputForEmbedding: string;

                    if (asset.type === 'image') {
                        inputForEmbedding = path.join(this.rootPath, asset.path);
                    } else if (asset.type === 'video' && asset.thumbnailPath) {
                        if (path.isAbsolute(asset.thumbnailPath)) {
                            inputForEmbedding = asset.thumbnailPath;
                        } else {
                            const cachedThumbnail = path.join(this.thumbnailCachePath, asset.thumbnailPath);
                            try {
                                await fs.access(cachedThumbnail);
                                inputForEmbedding = cachedThumbnail;
                            } catch {
                                inputForEmbedding = path.join(this.rootPath, asset.thumbnailPath);
                            }
                        }
                    } else {
                        inputForEmbedding = [
                            path.basename(asset.path),
                            ...(asset.metadata.tags || []),
                            asset.metadata.description || '',
                            asset.metadata.prompt || '',
                            asset.type
                        ].join(' ');
                    }

                    embedding = await embeddingService.generateEmbedding(inputForEmbedding);

                    // Save to shared file
                    // Save to shared file
                    if (embedding) {
                        try {
                            await fs.writeFile(sharedEmbeddingPath, JSON.stringify(embedding));
                            console.log(`[IndexerService] Saved shared embedding to ${sharedEmbeddingPath}`);
                        } catch (e) {
                            console.error(`[IndexerService] Failed to save shared embedding for ${asset.id} at ${sharedEmbeddingPath}:`, e);
                        }
                    } else {
                        console.warn(`[IndexerService] Generated embedding is null for ${asset.id}`);
                    }
                }

                if (embedding) {
                    // Update metadata with embedding
                    const newMetadata = { ...asset.metadata, embedding };

                    // 1. Update main assets table
                    assetService.updateAssetMetadata(asset.id, newMetadata);

                    // 2. Manually update vec_assets table
                    try {
                        const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(asset.id) as { rowid: number | bigint };
                        if (row) {
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

    public getStats() { return { ...this.stats }; }
    public async resync() { if (this.rootPath) await this.setRootPath(this.rootPath); }
    public async regenerateThumbnails() {
        this.stats.thumbnailsGenerated = 0;
        await this.processThumbnails();
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
            // Use forward slashes for consistency across platforms
            relativeDestDir = `uploads/${project}`;
            if (metadata?.scene) relativeDestDir = `${relativeDestDir}/${metadata.scene}`;
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


}

export const indexerService = new IndexerService();
