import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { VirtuosoGrid, type VirtuosoGridHandle } from 'react-virtuoso';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { useIpcListeners } from '../hooks/useIpcListeners';

import { FilterBar } from './FilterBar';
import { MediaViewer } from './MediaViewer';
import { BulkActionsBar } from './BulkActionsBar';
import { SettingsModal } from './SettingsModal';
import { ExplorerCell } from './ExplorerCell';

const GAP = 16;

export const Explorer: React.FC = () => {
    const assets = useStore(state => state.assets);
    const filter = useStore(state => state.filter);
    const loadAssets = useStore(state => state.loadAssets);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);
    const filterConfig = useStore(state => state.filterConfig);
    const sortConfig = useStore(state => state.sortConfig);
    const currentPath = useStore(state => state.currentPath);
    const gridSize = useSettingsStore(state => state.gridSize);
    const setScrollPosition = useSettingsStore(state => state.setScrollPosition);
    const getScrollPosition = useSettingsStore(state => state.getScrollPosition);

    const { isSettingsOpen, setSettingsOpen } = useSettingsStore();

    const virtuosoRef = useRef<VirtuosoGridHandle>(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Initialize global listeners
    useIpcListeners();

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

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

        // 3. Sort
        return [...result].sort((a, b) => {
            const { key, direction } = sortConfig;
            let valA = key === 'path' ? a.path : (a.metadata as any)[key] || 0;
            let valB = key === 'path' ? b.path : (b.metadata as any)[key] || 0;

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [assets, filter, filterConfig, sortConfig, useStore((state) => state.currentPath)]);

    const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
        setScrollPosition(currentPath || '', range.startIndex);

        // Show scroll indicator
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);

        // Calculate scroll progress (0-100)
        const progress = range.startIndex / Math.max(1, filteredAssets.length - 1);
        setScrollProgress(Math.min(100, progress * 100));
    }, [currentPath, setScrollPosition, filteredAssets.length]);

    return (
        <div className="flex h-full flex-col bg-background text-foreground">
            <div className="flex items-center justify-between border-b border-border bg-card p-2 shadow-sm z-10">
                <h2 className="font-semibold tracking-tight pl-3 px-2">Media Explorer</h2>
                <FilterBar />
            </div>

            <div className="flex-1 p-2 relative">
                {filteredAssets.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        No assets found
                    </div>
                ) : (
                    <>
                        <VirtuosoGrid
                            ref={virtuosoRef}
                            style={{ height: '100%' }}
                            totalCount={filteredAssets.length}
                            rangeChanged={handleRangeChanged}
                            components={{
                                List: React.forwardRef((props, ref) => (
                                    <div
                                        {...props}
                                        ref={ref}
                                        style={{
                                            ...(props as any).style,
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
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

                        {/* Scroll Position Indicator */}
                        {isScrolling && filteredAssets.length > 10 && (
                            <div className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-50">
                                <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
                                    <div className="text-sm font-medium text-foreground mb-1">
                                        {Math.round(scrollProgress)}%
                                    </div>
                                    <div className="w-2 h-32 bg-muted rounded-full relative overflow-hidden">
                                        <div
                                            className="absolute top-0 left-0 w-full bg-primary transition-all duration-300 rounded-full"
                                            style={{ height: `${scrollProgress}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1 text-center">
                                        {filteredAssets.length} items
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <MediaViewer />
            <BulkActionsBar />
            <SettingsModal open={isSettingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
};
