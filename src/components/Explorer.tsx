import React, { useEffect, useMemo } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { useIpcListeners } from '../hooks/useIpcListeners';

import { FilterBar } from './FilterBar';
import { MediaViewer } from './MediaViewer';
import { BulkActionsBar } from './BulkActionsBar';
import { SettingsModal } from './SettingsModal';
import { ExplorerCell } from './ExplorerCell';

const MIN_COLUMN_WIDTH = 300;
const GAP = 16;

export const Explorer: React.FC = () => {
    const assets = useStore(state => state.assets);
    const filter = useStore(state => state.filter);
    const loadAssets = useStore(state => state.loadAssets);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);
    const filterConfig = useStore(state => state.filterConfig);
    const sortConfig = useStore(state => state.sortConfig);

    const { isSettingsOpen, setSettingsOpen } = useSettingsStore();

    // Initialize global listeners
    useIpcListeners();

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

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

    return (
        <div className="flex h-full flex-col bg-background text-foreground">
            <div className="flex items-center justify-between border-b border-border bg-card p-2 shadow-sm z-10">
                <h2 className="font-semibold tracking-tight pl-3 px-2">Media Explorer</h2>
                <FilterBar />
            </div>

            <div className="flex-1 p-2">
                {filteredAssets.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        No assets found
                    </div>
                ) : (
                    <VirtuosoGrid
                        style={{ height: '100%' }}
                        totalCount={filteredAssets.length}
                        components={{
                            List: React.forwardRef((props, ref) => (
                                <div
                                    {...props}
                                    ref={ref}
                                    style={{
                                        ...(props as any).style,
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_COLUMN_WIDTH}px, 1fr))`,
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
                )}
            </div>

            <MediaViewer />
            <BulkActionsBar />
            <SettingsModal open={isSettingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
};
