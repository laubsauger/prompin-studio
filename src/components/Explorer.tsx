import React, { useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useStore } from '../store';
import { AssetCard } from './AssetCard';
import { FilterBar } from './FilterBar';
import { MediaViewer } from './MediaViewer';
import { BulkActionsBar } from './BulkActionsBar';

export const Explorer: React.FC = () => {
    const { assets, filter, loadAssets, setViewingAssetId } = useStore();

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const filteredAssets = filter === 'all'
        ? assets
        : assets.filter(a => a.status === filter);

    const MIN_COLUMN_WIDTH = 300;
    const GAP = 16;

    const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
        const { assets, columnCount } = data;
        const index = rowIndex * columnCount + columnIndex;

        if (index >= assets.length) return null;

        const asset = assets[index];

        // Adjust style for gap
        const itemStyle = {
            ...style,
            left: Number(style.left) + GAP,
            top: Number(style.top) + GAP,
            width: Number(style.width) - GAP,
            height: Number(style.height) - GAP,
        };

        return (
            <div style={itemStyle} onDoubleClick={() => setViewingAssetId(asset.id)}>
                <AssetCard asset={asset} />
            </div>
        );
    };

    return (
        <div className="explorer" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="header" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', zIndex: 10 }}>
                <h2>Media Explorer</h2>
                <FilterBar />
            </div>

            <div style={{ flex: 1, padding: '0 1rem 1rem 0' }}> {/* Padding handled in grid logic mostly, but container needs some */}
                <AutoSizer>
                    {({ height, width }: { height: number; width: number }) => {
                        const columnCount = Math.max(1, Math.floor((width) / (MIN_COLUMN_WIDTH + GAP)));
                        const columnWidth = (width - GAP) / columnCount; // Distribute remaining space
                        const rowHeight = columnWidth * (9 / 16) + 200; // Aspect ratio + info height

                        return (
                            <Grid
                                columnCount={columnCount}
                                columnWidth={columnWidth}
                                height={height}
                                rowCount={Math.ceil(filteredAssets.length / columnCount)}
                                rowHeight={rowHeight}
                                width={width}
                                itemData={{ assets: filteredAssets, columnCount }}
                            >
                                {Cell}
                            </Grid>
                        );
                    }}
                </AutoSizer>
            </div>

            <MediaViewer />
            <BulkActionsBar />
        </div>
    );
};
