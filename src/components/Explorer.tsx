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
import { AssetInspector } from './AssetInspector';

const GAP = 16;

const GridList = React.forwardRef<HTMLDivElement, any>(({ context, ...props }, ref) => (
    <div
        {...props}
        ref={ref}
        style={{
            ...props.style,
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${context.thumbnailSize}px, 1fr))`,
            gap: `${GAP}px`,
            paddingBottom: '20px'
        }}
    />
));

const GridItem = (props: any) => (
    <div {...props} style={{ ...props.style, margin: 0 }} />
);



export const Explorer: React.FC = () => {
    const assets = useStore(state => state.assets);
    const filter = useStore(state => state.filter);
    const loadAssets = useStore(state => state.loadAssets);
    const searchAssets = useStore(state => state.searchAssets);
    const searchQuery = useStore(state => state.searchQuery);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);
    const filterConfig = useStore(state => state.filterConfig);
    const sortConfig = useSettingsStore(state => state.sortConfig);
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
    }, [loadAssets, searchAssets, searchQuery, filterConfig, currentPath]);

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
        console.log('[Explorer] Filter Start. Total:', result.length, 'Path:', currentPath, 'Semantic:', filterConfig.semantic);

        // 0. Filter by Path
        const statePath = useStore.getState().currentPath;
        if (statePath) {
            result = result.filter(a => a.path.startsWith(statePath + '/'));
            console.log('[Explorer] After Path Filter:', result.length);
        }

        // 1. Filter by Status (multi-select with OR logic)
        if (filterConfig.status && filterConfig.status.length > 0) {
            result = result.filter(a => filterConfig.status.includes(a.status));
            console.log('[Explorer] After Status Filter:', result.length);
        } else if (filter !== 'all') {
            // Fallback to old single filter for backward compatibility
            result = result.filter(a => a.status === filter);
            console.log('[Explorer] After Legacy Status Filter:', result.length);
        }

        // 2. Filter by Liked
        if (filterConfig.likedOnly) {
            result = result.filter(a => a.metadata.liked);
            console.log('[Explorer] After Liked Filter:', result.length);
        }

        // 3. Filter by Type
        if (filterConfig.type && filterConfig.type !== 'all') {
            result = result.filter(a => a.type === filterConfig.type);
            console.log('[Explorer] After Type Filter:', result.length);
        }

        // 4. Filter by Tags (multi-select with OR logic)
        if (filterConfig.tagIds && filterConfig.tagIds.length > 0) {
            result = result.filter(a =>
                a.tags?.some(t => filterConfig.tagIds!.includes(t.id))
            );
            console.log('[Explorer] After Tags Filter:', result.length);
        } else if (filterConfig.tagId) {
            // Fallback to old single tag filter for backward compatibility
            result = result.filter(a => a.tags?.some(t => t.id === filterConfig.tagId));
            console.log('[Explorer] After Legacy Tag Filter:', result.length);
        }

        // 6. Filter by Scratch Pad
        if (filterConfig.scratchPadId) {
            const scratchPad = useStore.getState().scratchPads.find(p => p.id === filterConfig.scratchPadId);
            if (scratchPad) {
                result = result.filter(a => scratchPad.assetIds.includes(a.id));
            } else {
                result = [];
            }
            console.log('[Explorer] After ScratchPad Filter:', result.length);
        }

        // 7. Filter by Similarity Threshold (for semantic search)
        if (filterConfig.relatedToAssetId && filterConfig.semantic) {
            const threshold = 1 - (filterConfig.minSimilarity || 0); // Default 0
            console.log('[Explorer] Semantic Filter. Threshold:', threshold);
            result = result.filter(a => {
                const dist = a.distance ?? 1;
                // console.log(`[Explorer] Asset ${a.id} dist: ${dist}`);
                return dist <= threshold;
            });
            console.log('[Explorer] After Similarity Filter:', result.length);
        }

        // 8. Sort
        const sorted = [...result].sort((a, b) => {
            // Special handling for semantic search: Sort by distance (ascending)
            if (filterConfig.relatedToAssetId && filterConfig.semantic) {
                // Filter by similarity threshold first
                // distance is 0 (identical) to 1 (different). Similarity = 1 - distance.
                // We want similarity >= minSimilarity, so (1 - distance) >= minSimilarity => distance <= (1 - minSimilarity)
                const threshold = 1 - (filterConfig.minSimilarity || 0.7);
                if ((a.distance ?? 1) > threshold) return 1; // Filter out (push to end, effectively) - wait, filter should happen before sort?
                // Actually, let's filter in the filter block above, not in sort.

                const distA = a.distance ?? Infinity;
                const distB = b.distance ?? Infinity;
                return distA - distB;
            }

            const { key, direction } = sortConfig;
            const valA = key === 'path' ? a.path : (a.metadata as any)[key] || 0;
            const valB = key === 'path' ? b.path : (b.metadata as any)[key] || 0;

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        if (filterConfig.relatedToAssetId && filterConfig.semantic) {
            // Debug logging removed
        }

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
                <FilterBar
                    thumbnailSize={thumbnailSize}
                    onThumbnailSizeChange={setThumbnailSize}
                />
            </div>

            <div className="flex-1 flex relative min-h-0">
                <div className="flex-1 p-2 pr-0.5">
                    {filteredAssets.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No assets found
                        </div>
                    ) : viewMode === 'grid' ? (
                        <VirtuosoGrid
                            ref={virtuosoRef as React.RefObject<VirtuosoGridHandle>}
                            style={{ height: '100%', width: '100%' }}
                            data={filteredAssets}
                            rangeChanged={handleRangeChanged}
                            overscan={{ main: 1000, reverse: 1000 }}
                            context={{ thumbnailSize }}
                            computeItemKey={(_, asset) => asset.id}
                            components={{
                                List: GridList,
                                Item: GridItem
                            }}
                            itemContent={(_, asset) => {
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
                            data={filteredAssets}
                            rangeChanged={handleRangeChanged}
                            overscan={{ main: 1000, reverse: 1000 }}
                            computeItemKey={(_, asset) => asset.id}
                            itemContent={(_, asset) => {
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
                <AssetInspector />
            </div>

            <MediaViewer />
            <BulkActionsBar />
            <SettingsModal open={isSettingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
};
