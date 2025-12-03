import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from './store';

// Mock ipcRenderer
const mockInvoke = vi.fn();
window.ipcRenderer = {
    invoke: mockInvoke,
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
} as any;

// Mock uploadService
vi.mock('./services/uploadService', () => ({
    uploadService: {
        uploadFile: vi.fn().mockResolvedValue({ id: 'new-asset-id', path: 'new/path.jpg' })
    }
}));

describe('Store Actions', () => {
    beforeEach(() => {
        useStore.setState({
            assets: [],
            scratchPads: [],
            filterConfig: { likedOnly: false, type: 'all' },
            tags: []
        });
        mockInvoke.mockReset();
    });

    it('should create a scratch pad', () => {
        const { createScratchPad } = useStore.getState();
        createScratchPad('Test Pad');

        const { scratchPads } = useStore.getState();
        expect(scratchPads).toHaveLength(1);
        expect(scratchPads[0].name).toBe('Test Pad');
        expect(scratchPads[0].assetIds).toEqual([]);
    });

    it('should add assets to a scratch pad', () => {
        const { createScratchPad, addToScratchPad } = useStore.getState();
        createScratchPad('Test Pad');
        const padId = useStore.getState().scratchPads[0].id;

        addToScratchPad(padId, ['asset-1', 'asset-2']);

        const { scratchPads } = useStore.getState();
        expect(scratchPads[0].assetIds).toEqual(['asset-1', 'asset-2']);
    });

    it('should remove assets from a scratch pad', () => {
        const { createScratchPad, addToScratchPad, removeFromScratchPad } = useStore.getState();
        createScratchPad('Test Pad');
        const padId = useStore.getState().scratchPads[0].id;
        addToScratchPad(padId, ['asset-1', 'asset-2']);

        removeFromScratchPad(padId, 'asset-1');

        const { scratchPads } = useStore.getState();
        expect(scratchPads[0].assetIds).toEqual(['asset-2']);
    });

    it('should set filter config', () => {
        const { setFilterConfig } = useStore.getState();
        setFilterConfig({ likedOnly: true, type: 'video' });

        const { filterConfig } = useStore.getState();
        expect(filterConfig.likedOnly).toBe(true);
        expect(filterConfig.type).toBe('video');
    });

    it('should search assets', async () => {
        const { searchAssets } = useStore.getState();
        mockInvoke.mockResolvedValue([{ id: '1', path: 'test.jpg' }]);

        await searchAssets('query');

        expect(mockInvoke).toHaveBeenCalledWith('search-assets', 'query', expect.any(Object));
        const { assets } = useStore.getState();
        expect(assets).toHaveLength(1);
    });

    it('should handle upload and apply tags', async () => {
        const { handleUpload, tags } = useStore.getState();
        // Setup mock tags
        useStore.setState({ tags: [{ id: 'tag-1', name: 'Tag 1' }] });

        // Mock file
        const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
        useStore.setState({ ingestion: { isOpen: true, pendingFiles: [file], isUploading: false } });

        await handleUpload({
            project: 'Test Project',
            scene: 'Test Scene',
            tags: ['tag-1']
        });

        // Verify uploadService was called (implicitly via the mock result)
        // Verify add-tag-to-asset was called
        expect(mockInvoke).toHaveBeenCalledWith('add-tag-to-asset', 'new-asset-id', 'tag-1');

        // Verify assets state updated (optimistically or via result)
        const { assets } = useStore.getState();
        expect(assets).toHaveLength(1);
        expect(assets[0].id).toBe('new-asset-id');
    });
});
