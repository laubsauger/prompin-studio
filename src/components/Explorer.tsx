import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { VirtuosoGrid, Virtuoso, type VirtuosoGridHandle, type VirtuosoHandle } from 'react-virtuoso';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { useIpcListeners } from '../hooks/useIpcListeners';

import { FilterBar } from './FilterBar';
import { MediaViewer } from './MediaViewer';
import { BulkActionsBar } from './BulkActionsBar';
import { SettingsModal } from './SettingsModal';
import { ExplorerCell } from './ExplorerCell';
import { AssetListItem } from './AssetListItem';

const GAP = 16;

export const Explorer: React.FC = () => {
    const assets = useStore(state => state.assets);
    const filter = useStore(state => state.filter);
    const loadAssets = useStore(state => state.loadAssets);
    const searchAssets = useStore(state => state.searchAssets);
    const searchQuery = useStore(state => state.searchQuery);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);
    const filterConfig = useStore(state => state.filterConfig);
    const sortConfig = useStore(state => state.sortConfig);
    const currentPath = useStore(state => state.currentPath);
    const viewMode = useStore(state => state.viewMode);

    const setScrollPosition = useSettingsStore(state => state.setScrollPosition);
    const getScrollPosition = useSettingsStore(state => state.getScrollPosition);

    const { isSettingsOpen, setSettingsOpen } = useSettingsStore();

    const virtuosoRef = useRef<VirtuosoGridHandle | VirtuosoHandle>(null);
    const [thumbnailSize, setThumbnailSize] = useState(200);

    // Initialize global listeners
    useIpcListeners();

    useEffect(() => {
        // Load assets initially or when search/filters change
        if (searchQuery || Object.values(filterConfig).some(v => v && v !== 'all')) {
            searchAssets();
        } else {
            loadAssets();
        }
    }, [loadAssets, searchAssets, searchQuery, filterConfig]);

    // Restore scroll position when path changes
    useEffect(() => {
        const savedPosition = getScrollPosition(currentPath || '');
        if (savedPosition > 0 && virtuosoRef.current) {
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: savedPosition,
                    behavior: 'auto'
                });
            }, 100);
        }
    }, [currentPath, getScrollPosition]);

    const filteredAssets = useMemo(() => {
        let result = assets || [];

        // 0. Filter by Path
        const { currentPath } = useStore.getState();
        if (currentPath) {
            result = result.filter(a => a.path.startsWith(currentPath + '/'));
        }

        // 1. Filter by Status
        if (filter !== 'all') {
            result = result.filter(a => a.status === filter);
        }

        // 2. Filter by Liked
        if (filterConfig.likedOnly) {
            result = result.filter(a => a.metadata.liked);
        }

        // 3. Filter by Type
        if (filterConfig.type && filterConfig.type !== 'all') {
            result = result.filter(a => a.type === filterConfig.type);
        }

        // 4. Filter by Tag
        if (filterConfig.tagId) {
            result = result.filter(a => a.tags?.some(t => t.id === filterConfig.tagId));
        }

        // 5. Filter by Status (workflow feature)
        if (filterConfig.status && filterConfig.status !== 'all') {
            result = result.filter(a => a.status === filterConfig.status);
        }

        // 6. Filter by Scratch Pad
        if (filterConfig.scratchPadId) {
            const scratchPad = useStore.getState().scratchPads.find(p => p.id === filterConfig.scratchPadId);
            if (scratchPad) {
                result = result.filter(a => scratchPad.assetIds.includes(a.id));
            } else {
                result = [];
            }
        }

        // 6. Sort
        const sorted = [...result].sort((a, b) => {
            const { key, direction } = sortConfig;
            let valA = key === 'path' ? a.path : (a.metadata as any)[key] || 0;
            let valB = key === 'path' ? b.path : (b.metadata as any)[key] || 0;

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        console.log('[Explorer] filteredAssets length:', sorted.length);
        return sorted;
    }, [assets, filter, filterConfig, sortConfig, currentPath]);

    const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
        // Throttle position saving - only save every 10 items to reduce writes
        if (range.startIndex % 10 === 0) {
            setScrollPosition(currentPath || '', range.startIndex);
        }
    }, [currentPath, setScrollPosition]);

    return (
        <div className="flex h-full flex-col bg-background text-foreground">
            <div className="flex items-center justify-end border-b border-border bg-card p-2 shadow-sm z-10 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded border">
                    Debug: {filteredAssets.length} items
                </div>
                <FilterBar
                    thumbnailSize={thumbnailSize}
                    onThumbnailSizeChange={setThumbnailSize}
                />
            </div>

            <div className="flex-1 p-2 relative">
                {filteredAssets.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        No assets found
                    </div>
                ) : viewMode === 'grid' ? (
                    <VirtuosoGrid
                        ref={virtuosoRef as React.RefObject<VirtuosoGridHandle>}
                        style={{ height: '100%', width: '100%' }}
                        totalCount={filteredAssets.length}
                        rangeChanged={handleRangeChanged}
                        overscan={200}
                        components={{
                            List: React.forwardRef((props, ref) => (
                                <div
                                    {...props}
                                    ref={ref}
                                    style={{
                                        ...(props as any).style,
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
                                        gap: `${GAP}px`,
                                        paddingBottom: '20px'
                                    }}
                                />
                            )),
                            Item: (props) => (
                                <div {...props} style={{ ...props.style, margin: 0 }} />
                            )
                        }}
                        itemContent={(index) => {
                            const asset = filteredAssets[index];
                            return (
                                <div style={{ height: '100%' }}>
                                    <ExplorerCell
                                        asset={asset}
                                        setViewingAssetId={setViewingAssetId}
                                    />
                                </div>
                            );
                        }}
                    />
                ) : (
                    <Virtuoso
                        ref={virtuosoRef as React.RefObject<VirtuosoHandle>}
                        style={{ height: '100%', width: '100%' }}
                        totalCount={filteredAssets.length}
                        rangeChanged={handleRangeChanged}
                        overscan={200}
                        itemContent={(index) => {
                            const asset = filteredAssets[index];
                            return (
                                <div className="px-2 py-1">
                                    <AssetListItem
                                        asset={asset}
                                        setViewingAssetId={setViewingAssetId}
                                    />
                                </div>
                            );
                        }}
                    />
                )}
            </div>

            <MediaViewer />
            <BulkActionsBar />
            <SettingsModal open={isSettingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
};
