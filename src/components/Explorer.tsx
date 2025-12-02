// @ts-nocheck
import React, { useEffect, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Grid } from 'react-window';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { useIpcListeners } from '../hooks/useIpcListeners';

import { FilterBar } from './FilterBar';
import { MediaViewer } from './MediaViewer';
import { BulkActionsBar } from './BulkActionsBar';
import { SettingsModal } from './SettingsModal';
import { ExplorerCell } from './ExplorerCell';

const GAP = 16;
const MIN_COLUMN_WIDTH = 300;

export const Explorer: React.FC = () => {
    const { assets, filter, loadAssets, setViewingAssetId } = useStore();
    const { isSettingsOpen, setSettingsOpen } = useSettingsStore();

    // Initialize global listeners
    useIpcListeners();

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const filteredAssets = useMemo(() => {
        let result = assets;

        // 1. Filter by Status
        if (filter !== 'all') {
            result = result.filter(a => a.status === filter);
        }

        // 2. Filter by Liked
        const { filterConfig, sortConfig } = useStore.getState(); // Access latest config
        if (filterConfig.likedOnly) {
            result = result.filter(a => a.metadata.liked);
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
    }, [assets, filter, useStore((state) => state.filterConfig), useStore((state) => state.sortConfig)]);



    return (
        <div className="flex h-screen flex-col bg-background text-foreground">
            <div className="flex items-center justify-between border-b border-border bg-card p-4 shadow-sm z-10">
                <h2 className="text-lg font-semibold tracking-tight">Media Explorer</h2>
                <FilterBar />
            </div>

            <div className="flex-1 p-4">
                <AutoSizer>
                    {({ height, width }: { height: number; width: number }) => {
                        const columnCount = Math.max(1, Math.floor((width) / (MIN_COLUMN_WIDTH + GAP)));
                        const columnWidth = (width - GAP) / columnCount; // Distribute remaining space
                        const rowHeight = columnWidth * (9 / 16) + 200; // Aspect ratio + info height

                        return (
                            // @ts-ignore
                            <Grid
                                columnCount={columnCount}
                                columnWidth={columnWidth}
                                height={height}
                                rowCount={Math.ceil(filteredAssets.length / columnCount)}
                                rowHeight={rowHeight}
                                width={width}
                                itemData={{ assets: filteredAssets, columnCount, setViewingAssetId }}
                                children={ExplorerCell as any}
                            />
                        );
                    }}
                </AutoSizer>
            </div>

            <MediaViewer />
            <BulkActionsBar />
            <SettingsModal open={isSettingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
};
