import React, { useMemo } from 'react';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AssetCard } from './AssetCard';
import type { Asset } from '../types';
import { ArrowRight } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface LineageNodeProps {
    asset: Asset;
    depth: number;
    isRoot?: boolean;
}

const LineageNode: React.FC<LineageNodeProps> = ({ asset, depth, isRoot }) => {
    const assets = useStore(state => state.assets);

    // Find input assets
    const inputAssets = useMemo(() => {
        if (!asset.metadata.inputs || asset.metadata.inputs.length === 0) return [];
        return asset.metadata.inputs
            .map(id => assets.find(a => a.id === id))
            .filter((a): a is Asset => !!a);
    }, [asset, assets]);

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Render Inputs First (Recursively) */}
            {inputAssets.length > 0 && (
                <div className="flex gap-8 items-end mb-4">
                    {inputAssets.map(inputAsset => (
                        <div key={inputAsset.id} className="flex flex-col items-center relative">
                            <LineageNode asset={inputAsset} depth={depth + 1} />
                            {/* Connector Line */}
                            <div className="h-8 w-px bg-border my-2" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                        </div>
                    ))}
                </div>
            )}

            {/* Render Current Asset */}
            <div className="relative group">
                <div className={`w-64 transition-all duration-300 ${isRoot ? 'scale-110 ring-2 ring-primary ring-offset-2 rounded-xl' : ''}`}>
                    <AssetCard asset={asset} />
                </div>
                {isRoot && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        Selected Asset
                    </div>
                )}
            </div>
        </div>
    );
};

export const LineageView: React.FC = () => {
    const lineageAssetId = useStore(state => state.lineageAssetId);
    const setLineageAssetId = useStore(state => state.setLineageAssetId);
    const assets = useStore(state => state.assets);

    const rootAsset = useMemo(() =>
        assets.find(a => a.id === lineageAssetId),
        [assets, lineageAssetId]
    );

    if (!lineageAssetId) return null;

    return (
        <Dialog open={!!lineageAssetId} onOpenChange={(open) => !open && setLineageAssetId(null)}>
            <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl">
                <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
                    <DialogTitle>Asset Lineage</DialogTitle>

                </DialogHeader>

                <ScrollArea className="flex-1 w-full h-full">
                    <div className="min-w-full min-h-full flex items-center justify-center p-20">
                        {rootAsset ? (
                            <LineageNode asset={rootAsset} depth={0} isRoot />
                        ) : (
                            <div className="text-muted-foreground">Asset not found</div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
