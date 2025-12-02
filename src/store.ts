import { create } from 'zustand';
import type { Asset, SyncStats } from './types';

// Lazily load ipcRenderer to avoid issues during test initialization if window.require is not yet mocked
const getIpcRenderer = () => window.ipcRenderer;

interface AppState {
    assets: Asset[];
    syncStats: SyncStats | null;
    filter: Asset['status'] | 'all';
    selectedIds: Set<string>;
    lastSelectedId: string | null;
    viewingAssetId: string | null;

    sortConfig: { key: 'createdAt' | 'updatedAt' | 'path'; direction: 'asc' | 'desc' };
    filterConfig: { likedOnly: boolean };

    // Ingestion State
    ingestion: {
        isOpen: boolean;
        pendingFiles: File[];
        isUploading: boolean;
    };

    // Actions
    setSortConfig: (key: 'createdAt' | 'updatedAt' | 'path', direction: 'asc' | 'desc') => void;
    setFilterConfig: (config: Partial<AppState['filterConfig']>) => void;
    toggleLike: (id: string) => Promise<void>;

    // Ingestion Actions
    startIngestion: (files: File[]) => void;
    cancelIngestion: () => void;
    handleUpload: (metadata: { project: string; scene: string; tags: string[] }) => Promise<void>;

    setFilter: (filter: Asset['status'] | 'all') => void;
    setViewingAssetId: (id: string | null) => void;
    loadAssets: () => Promise<void>;
    fetchSyncStats: () => Promise<void>;
    triggerResync: () => Promise<void>;
    updateAssetStatus: (id: string, status: Asset['status']) => Promise<void>;
    addComment: (id: string, text: string) => Promise<void>;
    updateMetadata: (id: string, key: string, value: any) => Promise<void>;

    // Selection Actions
    toggleSelection: (id: string, multi: boolean) => void;
    selectRange: (id: string) => void;
    clearSelection: () => void;
    selectAll: () => void;
}

export const useStore = create<AppState>((set, get) => ({
    assets: [],
    syncStats: null,
    filter: 'all',
    selectedIds: new Set(),
    lastSelectedId: null,
    viewingAssetId: null,

    // New config initial state
    sortConfig: { key: 'createdAt', direction: 'desc' },
    filterConfig: { likedOnly: false },

    ingestion: {
        isOpen: false,
        pendingFiles: [],
        isUploading: false
    },

    setFilter: (filter) => set({ filter }),
    setViewingAssetId: (id) => set({ viewingAssetId: id }),

    // New config actions
    setSortConfig: (key, direction) => set({ sortConfig: { key, direction } }),
    setFilterConfig: (config) => set(state => ({ filterConfig: { ...state.filterConfig, ...config } })),

    toggleLike: async (id) => {
        const asset = get().assets.find(a => a.id === id);
        if (!asset) return;
        const newLiked = !asset.metadata.liked;

        // Optimistic update
        set(state => ({
            assets: state.assets.map(a => a.id === id ? { ...a, metadata: { ...a.metadata, liked: newLiked } } : a)
        }));

        await getIpcRenderer().invoke('update-metadata', id, 'liked', newLiked);
        await getIpcRenderer().invoke('update-metadata', id, 'liked', newLiked);
    },

    startIngestion: (files) => set({ ingestion: { isOpen: true, pendingFiles: files, isUploading: false } }),

    cancelIngestion: () => set({ ingestion: { isOpen: false, pendingFiles: [], isUploading: false } }),

    handleUpload: async (metadata) => {
        set(state => ({ ingestion: { ...state.ingestion, isUploading: true } }));

        const { pendingFiles } = get().ingestion;
        const { uploadService } = await import('./services/uploadService');

        try {
            // Upload all files
            const uploadPromises = pendingFiles.map(file => uploadService.uploadFile(file, metadata));
            const newAssets = await Promise.all(uploadPromises);

            // In a real app, we'd probably re-fetch assets or add these to the list
            // For now, let's just add them to the local state to see immediate results
            set(state => ({
                assets: [...newAssets, ...state.assets],
                ingestion: { isOpen: false, pendingFiles: [], isUploading: false }
            }));
        } catch (error) {
            console.error('Upload failed:', error);
            set(state => ({ ingestion: { ...state.ingestion, isUploading: false } }));
        }
    },

    loadAssets: async () => {
        const assets = await getIpcRenderer().invoke('get-assets');
        set({ assets });
    },

    fetchSyncStats: async () => {
        const syncStats = await getIpcRenderer().invoke('get-sync-stats');
        set({ syncStats });
    },

    triggerResync: async () => {
        await getIpcRenderer().invoke('trigger-resync');
        // Stats will be updated by polling or event listener (polling implemented in component for now)
    },

    updateAssetStatus: async (id, status) => {
        // Optimistic update
        set(state => ({
            assets: state.assets.map(a => a.id === id ? { ...a, status } : a)
        }));
        try {
            await getIpcRenderer().invoke('update-asset-status', id, status);
        } catch (error) {
            console.error('Failed to update status:', error);
            // Revert on failure could be implemented here
            get().loadAssets();
        }
    },

    addComment: async (id, text) => {
        const authorId = 'current-user'; // TODO: Auth
        await getIpcRenderer().invoke('add-comment', id, text, authorId);
        get().loadAssets();
    },

    updateMetadata: async (id, key, value) => {
        await getIpcRenderer().invoke('update-metadata', id, key, value);
        get().loadAssets();
    },

    toggleSelection: (id, multi) => {
        set(state => {
            const newSelected = new Set(multi ? state.selectedIds : []);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return { selectedIds: newSelected, lastSelectedId: id };
        });
    },

    selectRange: (id) => {
        set(state => {
            const { assets, lastSelectedId, selectedIds } = state;
            if (!lastSelectedId) return { selectedIds: new Set([id]), lastSelectedId: id };

            const currentIndex = assets.findIndex(a => a.id === id);
            const lastIndex = assets.findIndex(a => a.id === lastSelectedId);

            if (currentIndex === -1 || lastIndex === -1) return state;

            const start = Math.min(currentIndex, lastIndex);
            const end = Math.max(currentIndex, lastIndex);

            const newSelected = new Set(selectedIds);
            for (let i = start; i <= end; i++) {
                newSelected.add(assets[i].id);
            }

            return { selectedIds: newSelected, lastSelectedId: id };
        });
    },

    clearSelection: () => set({ selectedIds: new Set(), lastSelectedId: null }),

    selectAll: () => set(state => ({
        selectedIds: new Set(state.assets.map(a => a.id)),
        lastSelectedId: null
    }))
}));
