import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexerService } from './IndexerService.js';
import { searchService } from './SearchService.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp/prompin-studio-test'),
    },
}));

// Mock EmbeddingService
vi.mock('./indexer/EmbeddingService.js', () => ({
    embeddingService: {
        generateEmbedding: vi.fn().mockResolvedValue(new Array(512).fill(0.1)),
        init: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock other dependencies
vi.mock('./indexer/Scanner.js', () => {
    class MockScanner {
        scanDirectory = vi.fn(async (path, cb) => {
            await cb(path + '/test.jpg');
        });
        preScan = vi.fn().mockResolvedValue({ totalFiles: 1, totalFolders: 0, skippedFiles: 0, images: 1, videos: 0, other: 0 });
        getStats = vi.fn().mockReturnValue({ totalFiles: 1, totalFolders: 0, skippedFiles: 0, images: 1, videos: 0, other: 0 });
        resetStats = vi.fn();
    }
    return { Scanner: MockScanner };
});

vi.mock('./indexer/Watcher.js', () => {
    class MockWatcher {
        start = vi.fn();
        stop = vi.fn();
        on = vi.fn();
    }
    return { Watcher: MockWatcher };
});

vi.mock('./indexer/MetadataExtractor.js', () => {
    class MockMetadataExtractor {
        extract = vi.fn().mockResolvedValue({});
    }
    return { MetadataExtractor: MockMetadataExtractor };
});

vi.mock('./indexer/ThumbnailGenerator.js', () => {
    class MockThumbnailGenerator {
        generate = vi.fn().mockResolvedValue('thumb.jpg');
        processQueue = vi.fn();
    }
    return { ThumbnailGenerator: MockThumbnailGenerator };
});

// Mock the DB module with vector support
vi.mock('../db', () => {
    const assets = new Map<string, any>();
    const vecAssets = new Map<number, any>(); // rowid -> embedding

    const db = {
        prepare: (sql: string) => {
            // Mock INSERT into vec_assets
            if (sql.includes('INSERT INTO vec_assets')) {
                return {
                    run: (params: any) => {
                        // params is [rowid, embedding]
                    }
                };
            }

            // Mock DELETE from vec_assets
            if (sql.includes('DELETE FROM vec_assets')) {
                return {
                    run: (rowid: number) => {
                        vecAssets.delete(rowid);
                    }
                };
            }

            // Mock similarity search
            if (sql.includes('FROM vec_assets') && sql.includes('distance')) {
                return {
                    all: (params: any) => {
                        return [
                            {
                                id: '1',
                                rowid: 1,
                                distance: 0.1,
                                metadata: JSON.stringify({ name: 'Asset 1' }),
                                type: 'image',
                                path: 'test.jpg'
                            },
                            {
                                id: '2',
                                rowid: 2,
                                distance: 0.2,
                                metadata: JSON.stringify({ name: 'Asset 2' }),
                                type: 'image',
                                path: 'test2.jpg'
                            }
                        ];
                    }
                };
            }

            // Standard Asset Mocks
            if (sql.includes('INSERT INTO assets') || sql.includes('UPDATE assets')) {
                return {
                    run: function (...args: any[]) {
                        const params = args[0]; // better-sqlite3 style
                        if (params && params.id) {
                            const existing = assets.get(params.id) || {};
                            const merged = { ...existing, ...params };
                            if (typeof merged.metadata === 'string') {
                                try { merged.metadata = JSON.parse(merged.metadata); } catch { }
                            }
                            if (!merged.rowid) merged.rowid = assets.size + 1;
                            assets.set(params.id, merged);
                            return { lastInsertRowid: merged.rowid };
                        }
                    }
                };
            }

            if (sql.includes('SELECT * FROM assets')) {
                return {
                    all: () => Array.from(assets.values()).map(a => ({ ...a, metadata: JSON.stringify(a.metadata) })),
                    get: (id: string) => {
                        const a = assets.get(id);
                        return a ? { ...a, metadata: JSON.stringify(a.metadata) } : undefined;
                    }
                };
            }

            if (sql.includes('SELECT * FROM assets WHERE rowid = ?')) {
                return {
                    get: (rowid: number) => {
                        return Array.from(assets.values()).find(a => a.rowid === rowid);
                    }
                };
            }

            if (sql.includes('SELECT * FROM assets WHERE id IN')) {
                return {
                    all: (ids: string[]) => {
                        return Array.from(assets.values()).filter(a => ids.includes(a.id));
                    }
                };
            }

            return {
                run: vi.fn(),
                all: vi.fn(() => []),
                get: vi.fn()
            };
        },
        transaction: (fn: Function) => fn,
        pragma: vi.fn()
    };
    return { default: db, vectorSearchEnabled: true };
});

// Mock AssetManager
vi.mock('./AssetManager.js', () => {
    const assets = new Map<string, any>();
    class MockAssetManager {
        getAssets = vi.fn(() => Array.from(assets.values()));
        getAsset = vi.fn((id) => assets.get(id));
        upsertAsset = vi.fn((asset) => assets.set(asset.id, asset));
        deleteAsset = vi.fn((id) => assets.delete(id));
        updateThumbnail = vi.fn((id, path) => {
            const a = assets.get(id);
            if (a) a.thumbnailPath = path;
        });
        rehomeAssets = vi.fn();
    }
    return {
        AssetManager: MockAssetManager
    };
});

// Mock SyncService
vi.mock('./SyncService.js', () => {
    class MockSyncService {
        initialize = vi.fn();
        on = vi.fn();
        publish = vi.fn();
        stop = vi.fn();
    }
    return {
        SyncService: MockSyncService,
        syncService: new MockSyncService()
    };
});

describe('IndexerService Semantic Search', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompin-studio-test-semantic-'));
        // Reset services if needed
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should handle semantic search flag', async () => {
        const filePath = path.join(tempDir, 'test.jpg');
        await fs.writeFile(filePath, 'dummy content');
        await indexerService.setRootPath(tempDir);

        await new Promise(resolve => setTimeout(resolve, 500));

        const results = await searchService.searchAssets('test', { semantic: true });
        expect(results).toBeDefined();

        const { embeddingService } = await import('./indexer/EmbeddingService.js');
        const calls = (embeddingService.generateEmbedding as any).mock.calls;
        const fileCall = calls.find((args: any[]) => args[0].endsWith('test.jpg'));
        expect(fileCall).toBeDefined();

        const queryCall = calls.find((args: any[]) => args[0] === 'test');
        expect(queryCall).toBeDefined();
    });

    it('should filter by related asset', async () => {
        const results = await searchService.searchAssets('', { relatedToAssetId: 'some-id', semantic: true });
        expect(results).toBeDefined();
    });
});
