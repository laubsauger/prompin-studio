import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexerService } from './IndexerService';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock the DB module with a custom in-memory implementation
vi.mock('../db.js', () => {
    const assets = new Map<string, any>();

    const db = {
        pragma: vi.fn(),
        exec: vi.fn(),
        prepare: (sql: string) => {
            if (sql.includes('INSERT INTO assets')) {
                return {
                    run: (params: any) => {
                        const asset = { ...params, metadata: params.metadata }; // Already stringified in service
                        assets.set(asset.id, asset);
                        // Handle ON CONFLICT update (simplified)
                        if (params.path) {
                            // Find existing by path
                            for (const [key, val] of assets.entries()) {
                                if (val.path === params.path && val.id !== params.id) {
                                    assets.set(key, { ...val, ...asset, id: val.id }); // Update existing
                                    return;
                                }
                            }
                        }
                    }
                };
            }
            if (sql.includes('SELECT * FROM assets')) {
                return {
                    all: () => Array.from(assets.values())
                };
            }
            if (sql.includes('UPDATE assets SET status')) {
                return {
                    run: ({ id, status }: any) => {
                        const asset = assets.get(id);
                        if (asset) {
                            assets.set(id, { ...asset, status });
                        }
                    }
                };
            }
            if (sql.includes('SELECT metadata FROM assets')) {
                return {
                    get: (id: string) => {
                        const asset = assets.get(id);
                        return asset ? { metadata: asset.metadata } : undefined;
                    }
                }
            }
            return {
                run: vi.fn(),
                all: vi.fn(() => []),
                get: vi.fn()
            };
        }
    };
    return { default: db };
});

describe('IndexerService Integration', () => {
    let service: IndexerService;
    let tempDir: string;

    beforeEach(async () => {
        // Create temp directory
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-studio-test-'));
        service = new IndexerService();
    });

    afterEach(async () => {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should index existing files', async () => {
        // Create a dummy file
        const filePath = path.join(tempDir, 'test.jpg');
        await fs.writeFile(filePath, 'dummy content');

        await service.setRootPath(tempDir);

        // Wait for watcher to pick up (simple delay for now, ideally wait for event)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const assets = service.getAssets();
        expect(assets).toHaveLength(1);
        expect(assets[0].path).toBe('test.jpg');
        expect(assets[0].type).toBe('image');
    });

    it('should update asset status', async () => {
        const filePath = path.join(tempDir, 'test.jpg');
        await fs.writeFile(filePath, 'dummy content');
        await service.setRootPath(tempDir);
        await new Promise(resolve => setTimeout(resolve, 500));

        const assets = service.getAssets();
        const id = assets[0].id;

        service.updateAssetStatus(id, 'approved');

        const updatedAssets = service.getAssets();
        expect(updatedAssets[0].status).toBe('approved');
    });
});
