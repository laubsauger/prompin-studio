import { create } from 'zustand';
import type { Asset, SyncStats } from './types';

// Lazily load ipcRenderer to avoid issues during test initialization if window.require is not yet mocked
const getIpcRenderer = () => (window as any).require('electron').ipcRenderer;

interface AppState {
    assets: Asset[];
    syncStats: SyncStats | null;
    filter: Asset['status'] | 'all';
    selectedIds: Set<string>;
    lastSelectedId: string | null;
    viewingAssetId: string | null;

    // Actions
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

    setFilter: (filter) => set({ filter }),
    setViewingAssetId: (id) => set({ viewingAssetId: id }),

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
