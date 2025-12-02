import React from 'react';
import type { Asset } from '../types';
import { AssetCard } from './AssetCard';

interface ExplorerCellProps {
    asset: Asset;
    setViewingAssetId: (id: string | null) => void;
}

export const ExplorerCell: React.FC<ExplorerCellProps> = ({ asset, setViewingAssetId }) => {
    if (!asset) return null;

    return (
        <div onDoubleClick={() => setViewingAssetId(asset.id)}>
            <AssetCard asset={asset} />
        </div>
    );
};
