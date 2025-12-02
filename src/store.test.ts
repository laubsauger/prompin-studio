import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from './store';

// Mock electron IPC
const mockInvoke = vi.fn();
(window as any).require = () => ({
    ipcRenderer: {
        invoke: mockInvoke,
    },
});

describe('Store', () => {
    beforeEach(() => {
        useStore.setState({
            assets: [],
            syncStats: null,
            filter: 'all',
        });
        mockInvoke.mockReset();
    });

    it('should set filter', () => {
        const { setFilter } = useStore.getState();
        setFilter('approved');
        expect(useStore.getState().filter).toBe('approved');
    });

    it('should load assets', async () => {
        const mockAssets = [{ id: '1', path: 'test.jpg', status: 'unsorted' }];
        mockInvoke.mockResolvedValue(mockAssets);

        const { loadAssets } = useStore.getState();
        await loadAssets();

        expect(mockInvoke).toHaveBeenCalledWith('get-assets');
        expect(useStore.getState().assets).toEqual(mockAssets);
    });

    it('should update asset status optimistically', async () => {
        const initialAssets = [{ id: '1', path: 'test.jpg', status: 'unsorted' }];
        useStore.setState({ assets: initialAssets as any });

        const { updateAssetStatus } = useStore.getState();
        await updateAssetStatus('1', 'approved');

        expect(useStore.getState().assets[0].status).toBe('approved');
        expect(mockInvoke).toHaveBeenCalledWith('update-asset-status', '1', 'approved');
    });

    it('should handle selection', () => {
        const { toggleSelection, clearSelection } = useStore.getState();

        // Toggle single
        toggleSelection('1', false);
        expect(useStore.getState().selectedIds.has('1')).toBe(true);
        expect(useStore.getState().selectedIds.size).toBe(1);

        // Toggle another (single mode replaces)
        toggleSelection('2', false);
        expect(useStore.getState().selectedIds.has('1')).toBe(false);
        expect(useStore.getState().selectedIds.has('2')).toBe(true);

        // Toggle multi
        toggleSelection('1', true);
        expect(useStore.getState().selectedIds.has('1')).toBe(true);
        expect(useStore.getState().selectedIds.has('2')).toBe(true);

        // Clear
        clearSelection();
        expect(useStore.getState().selectedIds.size).toBe(0);
    });

    it('should handle range selection', () => {
        const initialAssets = [
            { id: '1', path: '1.jpg', status: 'unsorted' },
            { id: '2', path: '2.jpg', status: 'unsorted' },
            { id: '3', path: '3.jpg', status: 'unsorted' },
        ];
        useStore.setState({ assets: initialAssets as any });
        const { toggleSelection, selectRange } = useStore.getState();

        // Select first
        toggleSelection('1', false);

        // Range select to third
        selectRange('3');

        expect(useStore.getState().selectedIds.has('1')).toBe(true);
        expect(useStore.getState().selectedIds.has('2')).toBe(true);
        expect(useStore.getState().selectedIds.has('3')).toBe(true);
        expect(useStore.getState().selectedIds.size).toBe(3);
    });

    it('should add comment optimistically', async () => {
        const initialAssets = [{ id: '1', path: 'test.jpg', status: 'unsorted', metadata: {} }];
        useStore.setState({ assets: initialAssets as any });

        const { addComment } = useStore.getState();
        await addComment('1', 'Nice!');

        const asset = useStore.getState().assets[0];
        expect(asset.metadata.comments).toHaveLength(1);
        expect(asset.metadata.comments?.[0].text).toBe('Nice!');
        expect(mockInvoke).toHaveBeenCalledWith('add-comment', '1', 'Nice!', 'User');
    });

    it('should update metadata optimistically', async () => {
        const initialAssets = [{ id: '1', path: 'test.jpg', status: 'unsorted', metadata: {} }];
        useStore.setState({ assets: initialAssets as any });

        const { updateMetadata } = useStore.getState();
        await updateMetadata('1', 'project', 'GenStudio');

        const asset = useStore.getState().assets[0];
        expect(asset.metadata.project).toBe('GenStudio');
        expect(mockInvoke).toHaveBeenCalledWith('update-metadata', '1', 'project', 'GenStudio');
    });
});
