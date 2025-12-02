import React, { type CSSProperties } from 'react';
import type { Asset } from '../types';
import { AssetCard } from './AssetCard';

interface ExplorerCellProps {
    columnIndex: number;
    rowIndex: number;
    style: CSSProperties;
    data: {
        assets: Asset[];
        columnCount: number;
        setViewingAssetId: (id: string | null) => void;
    };
}

const GAP = 16;

export const ExplorerCell: React.FC<ExplorerCellProps> = ({ columnIndex, rowIndex, style, data }) => {
    const { assets, columnCount, setViewingAssetId } = data;
    const index = rowIndex * columnCount + columnIndex;
    const asset = assets[index];

    if (!asset) return null;

    // Adjust style for gap
    const itemStyle = {
        ...style,
        left: (style.left as number) + GAP,
        top: (style.top as number) + GAP,
        width: (style.width as number) - GAP,
        height: (style.height as number) - GAP,
    };

    return (
        <div style={itemStyle} onDoubleClick={() => setViewingAssetId(asset.id)}>
            <AssetCard asset={asset} />
        </div>
    );
};
