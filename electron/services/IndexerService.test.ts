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

// Mock the DB module with a custom in-memory implementation
vi.mock('../db', () => {
    const assets = new Map<string, any>();

    const db = {
        pragma: vi.fn(),
        exec: vi.fn(),
        prepare: (sql: string) => {
            if (sql.includes('INSERT INTO assets')) {
                return {
                    run: (params: any) => {
                        const asset = { ...params, metadata: typeof params.metadata === 'string' ? JSON.parse(params.metadata) : params.metadata };
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
                if (sql.includes('WHERE id = ?')) {
                    return {
                        get: (id: string) => {
                            const asset = assets.get(id);
                            return asset ? { ...asset, metadata: JSON.stringify(asset.metadata) } : undefined;
                        }
                    };
                }
                return {
                    all: () => Array.from(assets.values()).map(asset => ({
                        ...asset,
                        metadata: JSON.stringify(asset.metadata)
                    }))
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
            if (sql.includes('UPDATE assets SET metadata')) {
                return {
                    run: ({ id, metadata }: any) => {
                        const asset = assets.get(id);
                        if (asset) {
                            assets.set(id, { ...asset, metadata: JSON.parse(metadata) }); // Store as object in mock
                        }
                    }
                };
            }
            if (sql.includes('SELECT metadata FROM assets')) {
                return {
                    get: (id: string) => {
                        const asset = assets.get(id);
                        return asset ? { metadata: JSON.stringify(asset.metadata) } : undefined;
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

    it('should add comments', async () => {
        const filePath = path.join(tempDir, 'test.jpg');
        await fs.writeFile(filePath, 'dummy content');
        await service.setRootPath(tempDir);
        await new Promise(resolve => setTimeout(resolve, 500));

        const assets = service.getAssets();
        const id = assets[0].id;

        service.addComment(id, 'Great shot!', 'User1');

        const updatedAssets = service.getAssets();
        expect(updatedAssets[0].metadata.comments).toHaveLength(1);
        expect(updatedAssets[0].metadata.comments?.[0].text).toBe('Great shot!');
        expect(updatedAssets[0].metadata.comments?.[0].authorId).toBe('User1');
    });

    it('should update metadata', async () => {
        const filePath = path.join(tempDir, 'test.jpg');
        await fs.writeFile(filePath, 'dummy content');
        await service.setRootPath(tempDir);
        await new Promise(resolve => setTimeout(resolve, 500));

        const assets = service.getAssets();
        const id = assets[0].id;

        service.updateMetadata(id, 'project', 'Project X');
        service.updateMetadata(id, 'scene', 'Scene 1');

        const updatedAssets = service.getAssets();
        expect(updatedAssets[0].metadata.project).toBe('Project X');
        expect(updatedAssets[0].metadata.scene).toBe('Scene 1');
    });

    it('should ingest files', async () => {
        const sourceFile = path.join(tempDir, 'source.jpg');
        await fs.writeFile(sourceFile, 'test content');
        await service.setRootPath(tempDir);

        const asset = await service.ingestFile(sourceFile, { project: 'test-project' });

        expect(asset).toBeDefined();
        // Path separator handling for cross-platform
        const normalizedPath = asset.path.replace(/\\/g, '/');
        expect(normalizedPath).toContain('uploads/test-project/source.jpg');

        const destPath = path.join(tempDir, asset.path);
        const exists = await fs.access(destPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        // Verify it's in DB
        const assets = service.getAssets();
        expect(assets.find((a: any) => a.id === asset.id)).toBeDefined();
    });
});
