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
    const { assets, filter, loadAssets, setViewingAssetId } = useStore();
    const { isSettingsOpen, setSettingsOpen } = useSettingsStore();

    // Initialize global listeners
    useIpcListeners();

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const filteredAssets = useMemo(() => {
        let result = assets || [];

        // 1. Filter by Status
        if (filter !== 'all') {
            result = result.filter(a => a.status === filter);
        }

        // 2. Filter by Liked
        const { filterConfig } = useStore.getState();
        if (filterConfig.likedOnly) {
            result = result.filter(a => a.metadata.liked);
        }

        // 3. Sort
        const { sortConfig } = useStore.getState();
        return [...result].sort((a, b) => {
            const { key, direction } = sortConfig;
            let valA = key === 'path' ? a.path : (a.metadata as any)[key] || 0;
            let valB = key === 'path' ? b.path : (b.metadata as any)[key] || 0;

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [assets, filter, useStore((state) => state.filterConfig), useStore((state) => state.sortConfig)]);

    return (
        <div className="flex h-screen flex-col bg-background text-foreground">
            <div className="flex items-center justify-between border-b border-border bg-card p-4 shadow-sm z-10">
                <h2 className="text-lg font-semibold tracking-tight">Media Explorer</h2>
                <FilterBar />
            </div>

            <div className="flex-1 p-4">
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
                                        ...props.style,
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
