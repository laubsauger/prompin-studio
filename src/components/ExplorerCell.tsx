import React from 'react';
import type { Asset } from '../types';
import { AssetCard } from './AssetCard';

interface ExplorerCellProps {
    asset: Asset;
    setViewingAssetId: (id: string | null) => void;
}

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (prevProps: Readonly<ExplorerCellProps>, nextProps: Readonly<ExplorerCellProps>): boolean => {
    // If the asset IDs are different, definitely re-render
    if (prevProps.asset.id !== nextProps.asset.id) return false;

    // Check if the asset data actually changed (deep comparison of relevant fields)
    const prev = prevProps.asset;
    const next = nextProps.asset;

    return (
        prev.status === next.status &&
        prev.thumbnailPath === next.thumbnailPath &&
        prev.metadata.liked === next.metadata.liked &&
        prev.tags?.length === next.tags?.length &&
        (prev.tags?.every((tag, i) => tag.id === next.tags?.[i]?.id) ?? true)
    );
};

const ExplorerCellComponent: React.FC<ExplorerCellProps> = ({ asset, setViewingAssetId }) => {
    if (!asset) return null;

    return (
        <div onDoubleClick={() => setViewingAssetId(asset.id)}>
            <AssetCard asset={asset} />
        </div>
    );
};

export const ExplorerCell = React.memo(ExplorerCellComponent, arePropsEqual);
