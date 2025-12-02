import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../store';

// Mock ipcRenderer
const mockInvoke = vi.fn();
(window as any).ipcRenderer = {
    invoke: mockInvoke,
    on: vi.fn(),
    off: vi.fn(),
};

describe('Store - Likes & Filtering', () => {
    beforeEach(() => {
        useStore.setState({
            assets: [
                { id: '1', path: 'a.jpg', status: 'unsorted', type: 'image', createdAt: 1672531200000, updatedAt: 1672531200000, metadata: { liked: false } },
                { id: '2', path: 'b.jpg', status: 'approved', type: 'image', createdAt: 1672617600000, updatedAt: 1672617600000, metadata: { liked: true } },
                { id: '3', path: 'c.jpg', status: 'unsorted', type: 'image', createdAt: 1672704000000, updatedAt: 1672704000000, metadata: { liked: false } },
            ],
            filter: 'all',
            filterConfig: { likedOnly: false },
            sortConfig: { key: 'createdAt', direction: 'desc' },
        });
        mockInvoke.mockClear();
    });

    it('should toggle like status', async () => {
        const { toggleLike } = useStore.getState();
        await toggleLike('1');

        expect(useStore.getState().assets[0].metadata.liked).toBe(true);
        expect(mockInvoke).toHaveBeenCalledWith('update-metadata', '1', 'liked', true);
    });

    it('should update filter config', () => {
        const { setFilterConfig } = useStore.getState();
        setFilterConfig({ likedOnly: true });
        expect(useStore.getState().filterConfig.likedOnly).toBe(true);
    });

    it('should update sort config', () => {
        const { setSortConfig } = useStore.getState();
        setSortConfig('path', 'asc');
        expect(useStore.getState().sortConfig).toEqual({ key: 'path', direction: 'asc' });
    });
});
