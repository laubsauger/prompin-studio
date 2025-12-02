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
    );
};
