import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';


import type { Asset, SyncStats, AssetMetadata } from './types';

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

export interface FilterConfig {
    likedOnly: boolean;
    type: 'all' | 'image' | 'video';
    tagId?: string | null;  // Legacy single tag filter
    tagIds?: string[];  // New multi-select tags
    scratchPadId?: string | null;
    status: string[]; // Changed from optional AssetStatus | 'all' and statuses?: AssetStatus[]
    authorId?: string;
    project?: string;
    scene?: string;
    shot?: string;
    platform?: string;
    model?: string;
    dateFrom?: number;
    dateTo?: number;
    relatedToAssetId?: string;
    semantic?: boolean;
    minSimilarity?: number;
}

interface NavigationState {
    path: string | null;
    filterConfig: FilterConfig;
    searchQuery: string;
}

interface AppState {
    assets: Asset[];
    syncStats: SyncStats | null;
    filter: Asset['status'] | 'all';
    selectedIds: Set<string>;
    lastSelectedId: string | null;
    viewingAssetId: string | null;
    lineageAssetId: string | null;
    inspectorAsset: Asset | null;
    currentPath: string | null;
    viewMode: 'grid' | 'list';
    aspectRatio: 'square' | 'video' | 'portrait';
    isLoading: boolean;
    loadingMessage: string;

    // Navigation History
    navigationHistory: NavigationState[];
    navigationIndex: number;

    filterConfig: FilterConfig;
    searchQuery: string;
    folderColors: Record<string, string>;
    tags: { id: string; name: string; color?: string }[];
    folders: string[];
    scratchPads: { id: string; name: string; assetIds: string[] }[];
    lastInboxViewTime: number;
    metadataOptions: {
        authors: string[];
        projects: string[];
        scenes: string[];
        shots: string[];
        models: string[];
    };

    // Ingestion State
    ingestion: {
        isOpen: boolean;
        pendingFiles: File[];
        targetPath?: string;
        isUploading: boolean;
    };

    // Actions
    setFilterConfig: (config: Partial<AppState['filterConfig']>) => void;
    resetFilters: () => void;
    setSearchQuery: (query: string) => void;
    searchAssets: (query?: string, filters?: Partial<AppState['filterConfig']>) => Promise<void>;
    previewSearch: (query: string) => Promise<Asset[]>;
    setFolderColor: (path: string, color: string) => void;
    toggleLike: (id: string) => Promise<void>;
    setLastInboxViewTime: (time: number) => void;

    // Tag Actions
    loadTags: () => Promise<void>;
    fetchMetadataOptions: () => Promise<void>;
    loadFolders: () => Promise<void>;
    createTag: (name: string, color?: string) => Promise<{ id: string; name: string; color?: string }>;
    deleteTag: (id: string) => Promise<void>;
    addTagToAsset: (assetId: string, tagId: string) => Promise<void>;

    removeTagFromAsset: (assetId: string, tagId: string) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;

    // Ingestion Actions
    startIngestion: (files: File[], targetPath?: string) => void;
    cancelIngestion: () => void;
    handleUpload: (metadata: { project: string; scene: string; tags: string[]; description?: string; author?: string; targetPath?: string }) => Promise<void>;

    // Scratch Pad Actions
    createScratchPad: (name: string, initialAssetIds?: string[]) => string;
    deleteScratchPad: (id: string) => void;
    addToScratchPad: (padId: string, assetIds: string[]) => void;
    removeFromScratchPad: (padId: string, assetId: string) => void;
    renameScratchPad: (id: string, name: string) => void;

    // Active Views (Temporary saved searches)
    activeViews: Array<{ id: string; name: string; filterConfig: FilterConfig; query?: string }>;
    addActiveView: (name: string, filterConfig: FilterConfig, query?: string) => void;
    removeActiveView: (id: string) => void;
    updateActiveView: (id: string, config: Partial<FilterConfig>) => void;

    setFilter: (filter: Asset['status'] | 'all') => void;
    setViewingAssetId: (id: string | null) => void;
    setLineageAssetId: (id: string | null) => void;
    setInspectorAsset: (asset: Asset | null) => void;
    clearInspectorAsset: () => void;
    setCurrentPath: (path: string | null) => void;
    activeTab: 'explorer' | 'analytics';
    setActiveTab: (tab: 'explorer' | 'analytics') => void;
    setViewMode: (mode: 'grid' | 'list') => void;
    setAspectRatio: (ratio: 'square' | 'video' | 'portrait') => void;

    // Navigation History
    pushNavigationState: () => void;
    navigateBack: () => void;
    navigateForward: () => void;
    canNavigateBack: () => boolean;
    canNavigateForward: () => boolean;
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
    initStore: () => Promise<void>;
    rootPath: string | null;
    refreshAssets: () => Promise<void>;
    selectAll: () => void;
    onAssetUpdated: (asset: Asset) => void;
}

export const useStore = create<AppState>((set, get) => ({
    // ... existing state ...
    assets: [],
    syncStats: null,
    filter: 'all',
    rootPath: null,
    selectedIds: new Set(),
    lastSelectedId: null,
    viewingAssetId: null,
    lineageAssetId: null,
    inspectorAsset: null,
    currentPath: null, // null = root, string = relative path from root
    viewMode: 'grid',
    isLoading: true,
    loadingMessage: 'Initializing...',

    // Navigation History
    navigationHistory: [],
    navigationIndex: -1,

    // New config initial state
    filterConfig: { likedOnly: false, type: 'all', status: [], minSimilarity: 0 },
    searchQuery: '',
    folderColors: {},
    tags: [],
    folders: [],
    scratchPads: [],
    lastInboxViewTime: 0, // Should be persisted, but for now 0
    metadataOptions: {
        authors: [],
        projects: [],
        scenes: [],
        shots: [],
        models: []
    },

    ingestion: {
        isOpen: false,
        pendingFiles: [],
        targetPath: undefined,
        isUploading: false
    },

    setFilter: (filter) => set({ filter }),
    setViewingAssetId: (id) => set({ viewingAssetId: id }),
    setLineageAssetId: (id) => set({ lineageAssetId: id }),
    setInspectorAsset: (asset) => set({ inspectorAsset: asset }),
    clearInspectorAsset: () => set({ inspectorAsset: null }),
    setCurrentPath: (path) => {
        const state = get();
        // Only push to history if it's a meaningful change
        if (state.currentPath !== path) {
            get().pushNavigationState();
            set({ currentPath: path });
        }
    },
    activeTab: 'explorer',
    setActiveTab: (tab) => set({ activeTab: tab }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),

    // Navigation History Implementation
    pushNavigationState: () => {
        const state = get();
        const newState: NavigationState = {
            path: state.currentPath,
            filterConfig: { ...state.filterConfig },
            searchQuery: state.searchQuery
        };

        // If we're not at the end of history, truncate forward history
        const newHistory = state.navigationHistory.slice(0, state.navigationIndex + 1);
        newHistory.push(newState);

        // Limit history to 50 items
        if (newHistory.length > 50) {
            newHistory.shift();
        }

        set({
            navigationHistory: newHistory,
            navigationIndex: newHistory.length - 1
        });
    },

    navigateBack: () => {
        const state = get();
        if (state.navigationIndex > 0) {
            const targetIndex = state.navigationIndex - 1;
            const targetState = state.navigationHistory[targetIndex];

            set({
                currentPath: targetState.path,
                filterConfig: targetState.filterConfig,
                searchQuery: targetState.searchQuery,
                navigationIndex: targetIndex
            });

            // Trigger search/filter update
            get().searchAssets(targetState.searchQuery, targetState.filterConfig);
        }
    },

    navigateForward: () => {
        const state = get();
        if (state.navigationIndex < state.navigationHistory.length - 1) {
            const targetIndex = state.navigationIndex + 1;
            const targetState = state.navigationHistory[targetIndex];

            set({
                currentPath: targetState.path,
                filterConfig: targetState.filterConfig,
                searchQuery: targetState.searchQuery,
                navigationIndex: targetIndex
            });

            // Trigger search/filter update
            get().searchAssets(targetState.searchQuery, targetState.filterConfig);
        }
    },

    canNavigateBack: () => {
        const state = get();
        return state.navigationIndex > 0;
    },

    canNavigateForward: () => {
        const state = get();
        return state.navigationIndex < state.navigationHistory.length - 1;
    },

    // Aspect Ratio
    aspectRatio: 'square',
    setAspectRatio: (ratio: 'square' | 'video' | 'portrait') => set({ aspectRatio: ratio }),

    // New config actions
    setLastInboxViewTime: (time) => {
        try {
            localStorage.setItem('lastInboxViewTime', JSON.stringify(time));
        } catch (e) {
            console.error('Failed to persist lastInboxViewTime', e);
        }
        set({ lastInboxViewTime: time });
    },
    // Scratch Pad Actions
    createScratchPad: (name, initialAssetIds = []) => {
        const id = uuidv4();
        set(state => ({
            scratchPads: [...state.scratchPads, { id, name, assetIds: initialAssetIds }]
        }));
        return id;
    },

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

    // Active Views Implementation
    activeViews: [],
    addActiveView: (name, filterConfig, query) => set(state => {
        const existing = state.activeViews.find(v => v.name === name);
        if (existing) return { activeViews: state.activeViews };
        return {
            activeViews: [...state.activeViews, {
                id: uuidv4(),
                name,
                filterConfig,
                query
            }]
        };
    }),
    removeActiveView: (id) => set(state => ({
        activeViews: state.activeViews.filter(v => v.id !== id)
    })),
    updateActiveView: (id, config) => set(state => ({
        activeViews: state.activeViews.map(v =>
            v.id === id
                ? { ...v, filterConfig: { ...v.filterConfig, ...config } }
                : v
        )
    })),


    setFilterConfig: (config) => {
        const state = get();
        const newConfig = { ...state.filterConfig, ...config };

        // Check if there's a meaningful change
        const hasChanged = JSON.stringify(state.filterConfig) !== JSON.stringify(newConfig);
        if (hasChanged) {
            get().pushNavigationState();
        }

        // Persist to localStorage
        try {
            localStorage.setItem('filterConfig', JSON.stringify(newConfig));
        } catch (e) {
            console.error('Failed to persist filterConfig', e);
        }
        set({ filterConfig: newConfig });
    },
    resetFilters: () => {
        const emptyConfig: FilterConfig = {
            likedOnly: false,
            type: 'all',
            status: [],
            tagId: null,
            scratchPadId: null,
            authorId: undefined,
            project: undefined,
            scene: undefined,
            shot: undefined,
            platform: undefined,
            model: undefined,
            dateFrom: undefined,
            dateTo: undefined,
            relatedToAssetId: undefined,
            semantic: false,
            minSimilarity: 0
        };

        try {
            localStorage.setItem('filterConfig', JSON.stringify(emptyConfig));
        } catch (e) {
            console.error('Failed to persist filterConfig', e);
        }
        set({ filterConfig: emptyConfig, filter: 'all', searchQuery: '' });
        get().searchAssets('', emptyConfig);
    },
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
            if (filterConfig.status && (filterConfig.status as any) !== 'all' && filterConfig.status.length > 0) backendFilters.status = filterConfig.status;
            if (filterConfig.authorId) backendFilters.authorId = filterConfig.authorId;
            if (filterConfig.project) backendFilters.project = filterConfig.project;
            if (filterConfig.scene) backendFilters.scene = filterConfig.scene;
            if (filterConfig.shot) backendFilters.shot = filterConfig.shot;
            if (filterConfig.platform) backendFilters.platform = filterConfig.platform;
            if (filterConfig.model) backendFilters.model = filterConfig.model;
            if (filterConfig.dateFrom) backendFilters.dateFrom = filterConfig.dateFrom;
            if (filterConfig.dateTo) backendFilters.dateTo = filterConfig.dateTo;
            if (filterConfig.tagId) backendFilters.tagIds = [filterConfig.tagId];
            if (filterConfig.relatedToAssetId) backendFilters.relatedToAssetId = filterConfig.relatedToAssetId;
            if (filterConfig.semantic) backendFilters.semantic = filterConfig.semantic;

            if (filterConfig.scratchPadId) {
                const scratchPad = get().scratchPads.find(p => p.id === filterConfig.scratchPadId);
                if (scratchPad && scratchPad.assetIds.length > 0) {
                    backendFilters.ids = scratchPad.assetIds;
                } else if (scratchPad) {
                    // Empty scratch pad
                    backendFilters.ids = ['non-existent-id']; // Hack to return empty result
                }
            }

            console.log('[Store] searchAssets sending filters:', JSON.stringify(backendFilters, null, 2));

            const results = await getIpcRenderer().invoke('search-assets', searchQuery, backendFilters);
            console.log('[Store] searchAssets received count:', results.length);

            // Apply client-side filters that backend doesn't handle
            let filteredAssets = results;
            if (filterConfig.likedOnly) {
                filteredAssets = filteredAssets.filter((a: Asset) => a.metadata.liked);
            }

            set({ assets: filteredAssets });
        } catch (error) {
            console.error('Failed to search assets:', error);
        }
    },
    previewSearch: async (query) => {
        try {
            // Use same filters as main search but don't update state
            const filterConfig = get().filterConfig;
            const backendFilters: any = {};
            if (filterConfig.type && filterConfig.type !== 'all') backendFilters.type = filterConfig.type;
            if (filterConfig.status && filterConfig.status.length > 0) backendFilters.status = filterConfig.status;
            // ... (copy other filters if needed, or just search by query for Command K?)
            // Command K usually searches everything, but maybe respecting filters is good?
            // Let's respect filters for consistency, or maybe Command K should be global?
            // The prompt says "search files, metadata, projects..." implying global.
            // But if I have a filter active, I might expect it to apply.
            // Let's stick to global search for Command K for now as it's a "quick jump" tool.
            // Actually, let's keep it simple and just pass the query.

            const assets = await getIpcRenderer().invoke('search-assets', query, {});
            return assets;
        } catch (error) {
            console.error('Failed to preview search:', error);
            return [];
        }
    },
    setFolderColor: async (path, color) => {
        set(state => ({ folderColors: { ...state.folderColors, [path]: color } }));
        await getIpcRenderer().invoke('set-folder-color', path, color);
    },

    loadFolderColors: async () => {
        const folderColors = await getIpcRenderer().invoke('get-folder-colors');
        set({ folderColors });
    },

    refreshAssets: async () => {
        // Silent reload without full-screen loading
        try {
            await get().searchAssets();
            // Also load folders to ensure structure is up to date
            get().loadFolders();
        } catch (error) {
            console.error('Failed to refresh assets:', error);
        }
    },

    // Tag Actions
    loadTags: async () => {
        console.log('[Store] Loading tags...');
        const tags = await getIpcRenderer().invoke('get-tags');
        console.log('[Store] Loaded tags:', tags.length);
        set({ tags });
    },
    fetchMetadataOptions: async () => {
        const options = await getIpcRenderer().invoke('get-metadata-options');
        set({ metadataOptions: options });
    },
    loadFolders: async () => {
        const folders = await getIpcRenderer().invoke('get-folders');
        set({ folders });
    },
    createTag: async (name, color) => {
        const tag = await getIpcRenderer().invoke('create-tag', name, color);
        console.log('[Store] Created tag, reloading tags...');
        await get().loadTags();
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
        await get().refreshAssets();
    },
    removeTagFromAsset: async (assetId, tagId) => {
        await getIpcRenderer().invoke('remove-tag-from-asset', assetId, tagId);
        get().refreshAssets();
    },

    deleteAsset: async (id) => {
        // Optimistic update
        set(state => ({
            assets: state.assets.filter(a => a.id !== id),
            inspectorAsset: state.inspectorAsset?.id === id ? null : state.inspectorAsset,
            viewingAssetId: state.viewingAssetId === id ? null : state.viewingAssetId,
            selectedIds: new Set([...state.selectedIds].filter(sid => sid !== id))
        }));
        try {
            await getIpcRenderer().invoke('delete-asset', id);
        } catch (error) {
            console.error('Failed to delete asset:', error);
            get().refreshAssets();
        }
    },



    // ... existing state ...

    setRootPath: async () => {
        const path = await getIpcRenderer().invoke('open-directory-dialog');
        if (path) {
            // Clear assets immediately to prevent UI from requesting old assets against new root
            set({
                rootPath: path,
                currentPath: null,
                assets: [],
                tags: [],
                folders: [],
                folderColors: {}
            });

            await getIpcRenderer().invoke('set-root-path', path);
            localStorage.setItem('rootPath', path);

            // Reload assets after setting path
            get().loadAssets();
            get().loadFolderColors();
            get().loadTags();
            get().loadFolders();
        }
        return path;
    },



    initStore: async () => {
        set({ isLoading: true, loadingMessage: 'Initializing...' });

        // Load persisted config
        try {
            const storedFilter = localStorage.getItem('filterConfig');
            if (storedFilter) set({ filterConfig: JSON.parse(storedFilter) });

            const storedInbox = localStorage.getItem('lastInboxViewTime');
            if (storedInbox) set({ lastInboxViewTime: JSON.parse(storedInbox) });
        } catch (e) {
            console.error('Failed to load persisted config', e);
        }

        // Initial data loads
        await get().loadTags();
        await get().fetchMetadataOptions();
        await get().loadFolderColors();
        await get().loadFolders();

        // Robust Asset Loading Strategy
        // We want to ensure we don't show an empty screen if we know there are files.
        let retries = 0;
        const maxRetries = 5;

        while (retries < maxRetries) {
            // 1. Fetch latest stats
            await get().fetchSyncStats();
            const stats = get().syncStats;

            // 2. Fetch assets
            await get().loadAssets();
            const assets = get().assets;

            // 3. Verification
            const hasFiles = stats && stats.totalFiles > 0;
            const hasAssets = assets.length > 0;

            if (hasFiles && !hasAssets) {
                // Mismatch: Backend says files exist, but we got none.
                // This implies initialization/indexing is still catching up.
                console.log(`[Store] Init: Asset mismatch(Stats: ${stats.totalFiles}, Assets: 0).Retrying(${retries + 1}/${maxRetries})...`);
                set({ loadingMessage: `Loading assets(${retries + 1}/${maxRetries})...` });
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
                retries++;
            } else {
                // Consistent state (either we have assets, or we expect none)
                break;
            }
        }

        set({ isLoading: false, loadingMessage: '' });
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
        try {
            const assets = await getIpcRenderer().invoke('get-assets');
            set({ assets });
            // Also load folders to ensure structure is up to date
            get().loadFolders();
        } catch (error) {
            console.error('Failed to load assets:', error);
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

        set({ syncStats });

        // If we just finished scanning, reload assets to show new files/folders
        if (currentStats?.status === 'scanning' && syncStats.status === 'idle') {
            console.log('[Store] Sync completed, reloading assets...');
            get().loadAssets();
        }
    },

    triggerResync: async () => {
        await getIpcRenderer().invoke('trigger-resync');
        // Stats will be updated by polling or event listener (polling implemented in component for now)
    },

    updateAssetStatus: async (id, status) => {
        // Optimistic UI update
        set(state => ({
            assets: state.assets.map(a => a.id === id ? { ...a, status } : a)
        }));
        try {
            await getIpcRenderer().invoke('update-asset-status', id, status);
            // Refresh assets from backend to ensure persistence
            await get().refreshAssets();
        } catch (error) {
            console.error('Failed to update status:', error);
            // Revert UI if needed by reloading assets
            await get().refreshAssets();
        }
    },

    addComment: async (id, text) => {
        const authorId = 'current-user'; // TODO: Auth
        await getIpcRenderer().invoke('add-comment', id, text, authorId);
        get().refreshAssets();
    },

    updateMetadata: async (id, key, value) => {
        await getIpcRenderer().invoke('update-metadata', id, key, value);
        get().refreshAssets();
    },

    updateAssetMetadata: async (id, metadata) => {
        // Optimistic update
        set(state => ({
            assets: state.assets.map(a => a.id === id ? { ...a, metadata } : a)
        }));
        await getIpcRenderer().invoke('update-asset-metadata', id, metadata);
        get().refreshAssets();
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
                // Exclusive selection: always select just this item
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
    })),

    onAssetUpdated: (updatedAsset) => set(state => ({
        assets: state.assets.map(a => a.id === updatedAsset.id ? updatedAsset : a)
    }))
}));
