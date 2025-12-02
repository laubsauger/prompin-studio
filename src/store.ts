import { create } from 'zustand';
import type { Asset, SyncStats } from './types';

// Lazily load ipcRenderer to avoid issues during test initialization if window.require is not yet mocked
// Lazily load ipcRenderer to avoid issues during test initialization if window.require is not yet mocked
const getIpcRenderer = () => {
    if (window.ipcRenderer) return window.ipcRenderer;

    console.warn('ipcRenderer not found, using mock implementation');
    return {
        invoke: async (channel: string, ...args: any[]) => {
            console.log(`[Mock IPC] invoke: ${channel}`, args);
            if (channel === 'get-assets') return [];
            if (channel === 'get-sync-stats') return { totalFiles: 0, processedFiles: 0, status: 'idle', lastSync: Date.now() };
            if (channel === 'open-directory-dialog') {
                // Return a fake path after a short delay to simulate user interaction
                await new Promise(resolve => setTimeout(resolve, 500));
                return '/mock/user/media';
            }
            if (channel === 'set-root-path') return true;
            return null;
        },
        on: (channel: string, _func: (...args: any[]) => void) => {
            console.log(`[Mock IPC] on: ${channel}`);
        },
        off: (channel: string, _func: (...args: any[]) => void) => {
            console.log(`[Mock IPC] off: ${channel}`);
        }
    };
};

interface AppState {
    assets: Asset[];
    syncStats: SyncStats | null;
    filter: Asset['status'] | 'all';
    selectedIds: Set<string>;
    lastSelectedId: string | null;
    viewingAssetId: string | null;
    currentPath: string | null;

    sortConfig: { key: 'createdAt' | 'updatedAt' | 'path'; direction: 'asc' | 'desc' };
    filterConfig: { likedOnly: boolean; type: 'all' | 'image' | 'video' };
    folderColors: Record<string, string>;

    // Ingestion State
    ingestion: {
        isOpen: boolean;
        pendingFiles: File[];
        isUploading: boolean;
    };

    // Actions
    setSortConfig: (key: 'createdAt' | 'updatedAt' | 'path', direction: 'asc' | 'desc') => void;
    setFilterConfig: (config: Partial<AppState['filterConfig']>) => void;
    setFolderColor: (path: string, color: string) => void;
    toggleLike: (id: string) => Promise<void>;

    // Ingestion Actions
    startIngestion: (files: File[]) => void;
    cancelIngestion: () => void;
    handleUpload: (metadata: { project: string; scene: string; tags: string[] }) => Promise<void>;

    setFilter: (filter: Asset['status'] | 'all') => void;
    setViewingAssetId: (id: string | null) => void;
    setCurrentPath: (path: string | null) => void;
    loadAssets: () => Promise<void>;
    fetchSyncStats: () => Promise<void>;
    triggerResync: () => Promise<void>;
    updateAssetStatus: (id: string, status: Asset['status']) => Promise<void>;
    addComment: (id: string, text: string) => Promise<void>;
    updateMetadata: (id: string, key: string, value: any) => Promise<void>;
    regenerateThumbnails: () => Promise<void>;

    // Selection Actions
    toggleSelection: (id: string, multi: boolean) => void;
    selectRange: (id: string) => void;
    clearSelection: () => void;
    setRootPath: () => Promise<string | null>;
    loadFolderColors: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    // ... existing state ...
    assets: [],
    syncStats: null,
    filter: 'all',
    selectedIds: new Set(),
    lastSelectedId: null,
    viewingAssetId: null,
    currentPath: null, // null = root, string = relative path from root

    // New config initial state
    sortConfig: { key: 'createdAt', direction: 'desc' },
    filterConfig: { likedOnly: false, type: 'all' },
    folderColors: {},

    ingestion: {
        isOpen: false,
        pendingFiles: [],
        isUploading: false
    },

    setFilter: (filter) => set({ filter }),
    setViewingAssetId: (id) => set({ viewingAssetId: id }),
    setCurrentPath: (path) => set({ currentPath: path }),

    // New config actions
    setSortConfig: (key, direction) => set({ sortConfig: { key, direction } }),
    setFilterConfig: (config) => set(state => ({ filterConfig: { ...state.filterConfig, ...config } })),
    setFolderColor: async (path, color) => {
        set(state => ({ folderColors: { ...state.folderColors, [path]: color } }));
        await getIpcRenderer().invoke('set-folder-color', path, color);
    },

    loadFolderColors: async () => {
        const folderColors = await getIpcRenderer().invoke('get-folder-colors');
        set({ folderColors });
    },

    setRootPath: async () => {
        const path = await getIpcRenderer().invoke('open-directory-dialog');
        if (path) {
            await getIpcRenderer().invoke('set-root-path', path);
            // Reload assets after setting path
            get().loadAssets();
            get().loadFolderColors();
        }
        return path;
    },

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

    regenerateThumbnails: async () => {
        await getIpcRenderer().invoke('regenerate-thumbnails');
        get().loadAssets();
    },

    toggleSelection: (id, multi) => {
        set(state => {
            if (multi) {
                const newSelected = new Set(state.selectedIds);
                if (newSelected.has(id)) {
                    newSelected.delete(id);
                } else {
                    newSelected.add(id);
                }
                return { selectedIds: newSelected, lastSelectedId: id };
            } else {
                // If clicking the only selected item, deselect it
                if (state.selectedIds.size === 1 && state.selectedIds.has(id)) {
                    return { selectedIds: new Set(), lastSelectedId: null };
                }
                // Otherwise select only this item
                return { selectedIds: new Set([id]), lastSelectedId: id };
            }
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
