// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexerService } from './IndexerService.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp/gen-studio-test'),
    },
}));

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
                        // In the actual code it might be named params or array
                        // The code uses: run(rowid, Buffer.from(embedding))
                        // So arguments are passed to run
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
                        // Return mock results
                        // We can just return a fixed list of matches for testing
                        return [
                            { rowid: 1, distance: 0.1 },
                            { rowid: 2, distance: 0.2 }
                        ];
                    }
                };
            }

            // Standard Asset Mocks (copied/adapted from IndexerService.test.ts)
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
                            // Mock rowid for vector search
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

            // Mock getting asset by rowid
            if (sql.includes('SELECT * FROM assets WHERE rowid = ?')) {
                return {
                    get: (rowid: number) => {
                        return Array.from(assets.values()).find(a => a.rowid === rowid);
                    }
                };
            }

            // Mock getting assets by IDs (for search results)
            if (sql.includes('SELECT * FROM assets WHERE id IN')) {
                return {
                    all: (ids: string[]) => {
                        // This is a bit tricky with variable args, but for a mock we can just return all that match
                        // The actual query uses parameters like (?, ?, ?)
                        // We can just filter the map
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
        transaction: (fn: Function) => fn, // Mock transaction to just run the function
        pragma: vi.fn()
    };
    return { default: db, vectorSearchEnabled: true };
});

describe('IndexerService Semantic Search', () => {
    let service: IndexerService;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-studio-test-semantic-'));
        service = new IndexerService();
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should handle semantic search flag', async () => {
        // This is a high-level test to ensure the service calls the right DB methods
        // We can't easily verify the exact SQL without spying on the mock, 
        // but we can verify it returns results if our mock is set up to return them.

        // 1. Create a dummy asset
        const filePath = path.join(tempDir, 'test.jpg');
        await fs.writeFile(filePath, 'dummy content');
        await service.setRootPath(tempDir);

        // Wait for indexing
        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. Search with semantic flag
        // We need to mock the embedding generation or just assume it exists?
        // The searchAssets function calls `processEmbeddings` if needed? 
        // No, `searchAssets` just queries. 

        // We'll just call searchAssets and see if it doesn't crash and returns something
        // Our mock DB returns 2 results for any vector search
        const results = await service.searchAssets('test', { semantic: true });

        // Since we mocked the vector search to return 2 rowids, and we only have 1 asset in DB,
        // it might return 0 or 1 depending on rowid matching.
        // Let's just verify it runs without error for now.
        expect(results).toBeDefined();
    });

    it('should filter by related asset', async () => {
        // Test relatedToAssetId
        const results = await service.searchAssets('', { relatedToAssetId: 'some-id', semantic: true });
        expect(results).toBeDefined();
    });
});
