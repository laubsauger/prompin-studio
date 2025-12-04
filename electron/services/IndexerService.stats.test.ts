import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexerService } from './IndexerService.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp/prompin-studio-test'),
    },
    BrowserWindow: class { }
}));

// Mock DB
vi.mock('../db', () => {
    return {
        default: {
            prepare: vi.fn(() => ({
                get: vi.fn(() => ({ count: 0 })),
                run: vi.fn(),
                all: vi.fn(() => [])
            }))
        },
        vectorSearchEnabled: false
    };
});

// Mock other services to avoid side effects, but KEEP Scanner real
vi.mock('./AssetManager.js', () => ({
    AssetManager: class {
        getAssets = vi.fn(() => []);
        getAsset = vi.fn();
        upsertAsset = vi.fn();
        deleteAsset = vi.fn();
        updateThumbnail = vi.fn();
        rehomeAssets = vi.fn();
    }
}));
vi.mock('./SyncService.js', () => ({
    SyncService: class {
        initialize = vi.fn();
        on = vi.fn();
        publish = vi.fn();
    }
}));
vi.mock('./indexer/EmbeddingService.js', () => ({
    embeddingService: {
        generateEmbedding: vi.fn(),
        init: vi.fn()
    }
}));
vi.mock('./indexer/ThumbnailGenerator.js');
vi.mock('./indexer/MetadataExtractor.js', () => ({
    MetadataExtractor: class {
        extract = vi.fn().mockResolvedValue({});
    }
}));
vi.mock('./SearchService.js', () => ({
    searchService: {
        setRootPath: vi.fn()
    }
}));
vi.mock('./FolderService.js', () => ({
    folderService: {
        setRootPath: vi.fn()
    }
}));
vi.mock('./AssetService.js', () => ({
    assetService: {
        setRootPath: vi.fn(),
        getAssets: vi.fn(() => [])
    }
}));
vi.mock('./TagService.js', () => ({
    tagService: {}
}));

describe('IndexerService Stats Integration', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompin-studio-stats-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should correctly count files and types', async () => {
        // Create some test files
        await fs.writeFile(path.join(tempDir, 'image1.jpg'), 'content');
        await fs.writeFile(path.join(tempDir, 'image2.png'), 'content');
        await fs.writeFile(path.join(tempDir, 'video1.mp4'), 'content');
        await fs.writeFile(path.join(tempDir, 'doc.txt'), 'content');
        await fs.mkdir(path.join(tempDir, 'subfolder'));
        await fs.writeFile(path.join(tempDir, 'subfolder', 'image3.jpg'), 'content');

        console.log('Test: Created files in', tempDir);

        await indexerService.setRootPath(tempDir);

        const stats = indexerService.getStats();
        console.log('Test: Stats received:', stats);

        expect(stats.totalFiles).toBe(4); // 3 images + 1 video. doc.txt is skipped.
        expect(stats.totalFolders).toBe(1);
        expect(stats.filesByType!.images).toBe(3);
        expect(stats.filesByType!.videos).toBe(1);
        expect(stats.filesByType!.other).toBe(0);
    });
});
