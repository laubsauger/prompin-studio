import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';


import type { Asset, SyncStats, AssetStatus, AssetMetadata } from './types';

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
    lineageAssetId: string | null;
    currentPath: string | null;
    viewMode: 'grid' | 'list';
    isLoading: boolean;
    loadingMessage: string;

    sortConfig: { key: 'createdAt' | 'updatedAt' | 'path'; direction: 'asc' | 'desc' };
    filterConfig: {
        likedOnly: boolean;
        type: 'all' | 'image' | 'video';
        tagId?: string | null;
        scratchPadId?: string | null;
        status?: AssetStatus | 'all';
        authorId?: string;
        project?: string;
        scene?: string;
        shot?: string;
        platform?: string;
        model?: string;
        dateFrom?: number;
        dateTo?: number;
    };
    searchQuery: string;
    folderColors: Record<string, string>;
    tags: { id: string; name: string; color?: string }[];
    scratchPads: { id: string; name: string; assetIds: string[] }[];

    // Ingestion State
    ingestion: {
        isOpen: boolean;
        pendingFiles: File[];
        targetPath?: string;
        isUploading: boolean;
    };

    // Actions
    setSortConfig: (key: 'createdAt' | 'updatedAt' | 'path', direction: 'asc' | 'desc') => void;
    setFilterConfig: (config: Partial<AppState['filterConfig']>) => void;
    setSearchQuery: (query: string) => void;
    searchAssets: (query?: string, filters?: Partial<AppState['filterConfig']>) => Promise<void>;
    setFolderColor: (path: string, color: string) => void;
    toggleLike: (id: string) => Promise<void>;

    // Tag Actions
    loadTags: () => Promise<void>;
    createTag: (name: string, color?: string) => Promise<{ id: string; name: string; color?: string }>;
    deleteTag: (id: string) => Promise<void>;
    addTagToAsset: (assetId: string, tagId: string) => Promise<void>;
    removeTagFromAsset: (assetId: string, tagId: string) => Promise<void>;

    // Ingestion Actions
    startIngestion: (files: File[], targetPath?: string) => void;
    cancelIngestion: () => void;
    handleUpload: (metadata: { project: string; scene: string; tags: string[]; description?: string; author?: string; targetPath?: string }) => Promise<void>;

    // Scratch Pad Actions
    createScratchPad: (name: string) => void;
    deleteScratchPad: (id: string) => void;
    addToScratchPad: (padId: string, assetIds: string[]) => void;
    removeFromScratchPad: (padId: string, assetId: string) => void;
    renameScratchPad: (id: string, name: string) => void;

    setFilter: (filter: Asset['status'] | 'all') => void;
    setViewingAssetId: (id: string | null) => void;
    setLineageAssetId: (id: string | null) => void;
    setCurrentPath: (path: string | null) => void;
    setViewMode: (mode: 'grid' | 'list') => void;
    setLoading: (isLoading: boolean, message?: string) => void;
    loadAssets: () => Promise<void>;
    fetchSyncStats: () => Promise<void>;
    triggerResync: () => Promise<void>;
    updateAssetStatus: (id: string, status: Asset['status']) => Promise<void>;
    addComment: (id: string, text: string) => Promise<void>;
    updateMetadata: (id: string, key: string, value: any) => Promise<void>;
    updateAssetMetadata: (id: string, metadata: AssetMetadata) => Promise<void>;
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
    lineageAssetId: null,
    currentPath: null, // null = root, string = relative path from root
    viewMode: 'grid',
    isLoading: false,
    loadingMessage: '',

    // New config initial state
    sortConfig: { key: 'createdAt', direction: 'desc' },
    filterConfig: { likedOnly: false, type: 'all' },
    searchQuery: '',
    folderColors: {},
    tags: [],
    scratchPads: [],

    ingestion: {
        isOpen: false,
        pendingFiles: [],
        targetPath: undefined,
        isUploading: false
    },

    setFilter: (filter) => set({ filter }),
    setViewingAssetId: (id) => set({ viewingAssetId: id }),
    setLineageAssetId: (id) => set({ lineageAssetId: id }),
    setCurrentPath: (path) => set({ currentPath: path }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),

    // New config actions
    setSortConfig: (key, direction) => set({ sortConfig: { key, direction } }),
    // Scratch Pad Actions
    createScratchPad: (name) => set(state => ({
        scratchPads: [...state.scratchPads, { id: uuidv4(), name, assetIds: [] }]
    })),

    deleteScratchPad: (id) => set(state => ({
        scratchPads: state.scratchPads.filter(p => p.id !== id),
        filterConfig: state.filterConfig.scratchPadId === id
            ? { ...state.filterConfig, scratchPadId: null }
            : state.filterConfig
    })),

    addToScratchPad: (padId, assetIds) => set(state => ({
        scratchPads: state.scratchPads.map(p =>
            p.id === padId
                ? { ...p, assetIds: [...new Set([...p.assetIds, ...assetIds])] }
                : p
        )
    })),

    removeFromScratchPad: (padId, assetId) => set(state => ({
        scratchPads: state.scratchPads.map(p =>
            p.id === padId
                ? { ...p, assetIds: p.assetIds.filter(id => id !== assetId) }
                : p
        )
    })),

    renameScratchPad: (id, name) => set(state => ({
        scratchPads: state.scratchPads.map(p =>
            p.id === id ? { ...p, name } : p
        )
    })),


    setFilterConfig: (config) => set(state => ({ filterConfig: { ...state.filterConfig, ...config } })),
    setSearchQuery: (query) => set({ searchQuery: query }),
    searchAssets: async (query, filters) => {
        const searchQuery = query ?? get().searchQuery;
        const filterConfig = filters ? { ...get().filterConfig, ...filters } : get().filterConfig;

        // Don't show full-screen loading for search - it's too jarring
        // Just update the assets when ready
        try {
            // Build filters for backend
            const backendFilters: any = {};
            if (filterConfig.type && filterConfig.type !== 'all') backendFilters.type = filterConfig.type;
            if (filterConfig.status && filterConfig.status !== 'all') backendFilters.status = filterConfig.status;
            if (filterConfig.authorId) backendFilters.authorId = filterConfig.authorId;
            if (filterConfig.project) backendFilters.project = filterConfig.project;
            if (filterConfig.scene) backendFilters.scene = filterConfig.scene;
            if (filterConfig.shot) backendFilters.shot = filterConfig.shot;
            if (filterConfig.platform) backendFilters.platform = filterConfig.platform;
            if (filterConfig.model) backendFilters.model = filterConfig.model;
            if (filterConfig.dateFrom) backendFilters.dateFrom = filterConfig.dateFrom;
            if (filterConfig.dateTo) backendFilters.dateTo = filterConfig.dateTo;
            if (filterConfig.tagId) backendFilters.tagIds = [filterConfig.tagId];

            const assets = await getIpcRenderer().invoke('search-assets', searchQuery, backendFilters);

            // Apply client-side filters that backend doesn't handle
            let filteredAssets = assets;
            if (filterConfig.likedOnly) {
                filteredAssets = filteredAssets.filter((a: Asset) => a.metadata.liked);
            }

            set({ assets: filteredAssets });
        } catch (error) {
            console.error('Failed to search assets:', error);
        }
    },
    setFolderColor: async (path, color) => {
        set(state => ({ folderColors: { ...state.folderColors, [path]: color } }));
        await getIpcRenderer().invoke('set-folder-color', path, color);
    },

    // Tag Actions
    loadTags: async () => {
        const tags = await getIpcRenderer().invoke('get-tags');
        set({ tags });
    },
    createTag: async (name, color) => {
        const tag = await getIpcRenderer().invoke('create-tag', name, color);
        get().loadTags();
        return tag;
    },
    deleteTag: async (id) => {
        await getIpcRenderer().invoke('delete-tag', id);
        get().loadTags();
    },
    addTagToAsset: async (assetId, tagId) => {
        await getIpcRenderer().invoke('add-tag-to-asset', assetId, tagId);
        // We might need to reload assets to get updated tags if they are part of asset metadata
        // Or we can just reload tags if we want to update counts (if we had them)
        // For now, let's reload assets to be safe if we decide to include tags in asset objects
        get().loadAssets();
    },
    removeTagFromAsset: async (assetId, tagId) => {
        await getIpcRenderer().invoke('remove-tag-from-asset', assetId, tagId);
        get().loadAssets();
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
            get().loadTags();
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
    },

    startIngestion: (files, targetPath) => set({ ingestion: { isOpen: true, pendingFiles: files, targetPath, isUploading: false } }),

    cancelIngestion: () => set({ ingestion: { isOpen: false, pendingFiles: [], targetPath: undefined, isUploading: false } }),

    handleUpload: async (metadata) => {
        set(state => ({ ingestion: { ...state.ingestion, isUploading: true } }));

        const { pendingFiles } = get().ingestion;
        const { uploadService } = await import('./services/uploadService');

        try {
            // Upload all files
            const uploadPromises = pendingFiles.map(file => uploadService.uploadFile(file, metadata));
            const newAssets = await Promise.all(uploadPromises);

            // Apply tags if present
            if (metadata.tags && metadata.tags.length > 0) {
                const addTagPromises = [];
                for (const asset of newAssets) {
                    for (const tagId of metadata.tags) {
                        // We assume these are tag IDs now
                        addTagPromises.push(getIpcRenderer().invoke('add-tag-to-asset', asset.id, tagId));

                        // Also update local asset state to include the tag
                        // We need to find the tag object to add it to the asset locally
                        const tag = get().tags.find(t => t.id === tagId);
                        if (tag) {
                            if (!asset.tags) asset.tags = [];
                            asset.tags.push(tag);
                        }
                    }
                }
                await Promise.all(addTagPromises);
            }

            // In a real app, we'd probably re-fetch assets or add these to the list
            // For now, let's just add them to the local state to see immediate results
            set(state => ({
                assets: [...newAssets, ...state.assets],
                ingestion: { isOpen: false, pendingFiles: [], targetPath: undefined, isUploading: false }
            }));
        } catch (error) {
            console.error('Upload failed:', error);
            set(state => ({ ingestion: { ...state.ingestion, isUploading: false } }));
        }
    },

    loadAssets: async () => {
        set({ isLoading: true, loadingMessage: 'Loading assets...' });
        try {
            const assets = await getIpcRenderer().invoke('get-assets');
            set({ assets, isLoading: false, loadingMessage: '' });
        } catch (error) {
            console.error('Failed to load assets:', error);
            set({ isLoading: false, loadingMessage: '' });
        }
    },

    fetchSyncStats: async () => {
        const syncStats = await getIpcRenderer().invoke('get-sync-stats');

        // Only update if syncStats actually changed (deep comparison of key fields)
        const currentStats = useStore.getState().syncStats;
        if (currentStats) {
            const hasChanged =
                currentStats.status !== syncStats.status ||
                currentStats.totalFiles !== syncStats.totalFiles ||
                currentStats.processedFiles !== syncStats.processedFiles ||
                currentStats.totalFolders !== syncStats.totalFolders ||
                currentStats.thumbnailsGenerated !== syncStats.thumbnailsGenerated ||
                currentStats.thumbnailsFailed !== syncStats.thumbnailsFailed ||
                (currentStats.errors?.length || 0) !== (syncStats.errors?.length || 0);

            if (!hasChanged) {
                return; // Don't update state if nothing changed
            }
        }

        console.log('[Store] fetchSyncStats received changes:', syncStats);

        // If we just finished scanning, reload assets to show new files/folders
        if (currentStats?.status === 'scanning' && syncStats.status === 'idle') {
            console.log('[Store] Sync completed, reloading assets...');
            get().loadAssets();
        }

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

    updateAssetMetadata: async (id, metadata) => {
        // Optimistic update
        set(state => ({
            assets: state.assets.map(a => a.id === id ? { ...a, metadata } : a)
        }));
        await getIpcRenderer().invoke('update-asset-metadata', id, metadata);
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
