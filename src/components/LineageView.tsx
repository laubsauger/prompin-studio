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

    // Find input assets (parents)
    const inputAssets = useMemo(() => {
        if (!asset.metadata.inputs || asset.metadata.inputs.length === 0) return [];
        return asset.metadata.inputs
            .map(id => assets.find(a => a.id === id))
            .filter((a): a is Asset => !!a);
    }, [asset, assets]);

    // Find output assets (children) - assets that have this asset as an input
    const outputAssets = useMemo(() => {
        return assets.filter(a => a.metadata.inputs?.includes(asset.id));
    }, [asset, assets]);

    return (
        <div className="flex items-center gap-8">
            {/* Render Inputs (Parents) to the Left */}
            {inputAssets.length > 0 && (
                <div className="flex flex-col gap-8 items-end">
                    {inputAssets.map(inputAsset => (
                        <div key={inputAsset.id} className="flex items-center relative">
                            <LineageNode asset={inputAsset} depth={depth - 1} />
                            {/* Connector Line */}
                            <div className="w-8 h-px bg-border mx-2" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                    ))}
                </div>
            )}

            {/* Render Current Asset */}
            <div className="relative group flex flex-col items-center">
                <div className={`w-64 transition-all duration-300 ${isRoot ? 'scale-110 ring-2 ring-primary ring-offset-2 rounded-xl' : ''}`}>
                    <AssetCard asset={asset} />
                </div>
                {isRoot && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        Selected Asset
                    </div>
                )}
            </div>

            {/* Render Outputs (Children) to the Right - ONLY if isRoot to avoid infinite recursion for now, or handle better layout */}
            {/* Actually, for a tree view, we usually expand outwards. 
               The current recursive structure `LineageNode` renders its own inputs.
               If we add outputs here, we need to be careful about direction.
               
               If we are traversing UP (inputs), we shouldn't render outputs of inputs (siblings).
               If we are traversing DOWN (outputs), we shouldn't render inputs of outputs (which would be us).
               
               Let's change the strategy:
               The `LineageView` should render the Root.
               The Root renders its Inputs (left) and Outputs (right).
               The Inputs render their Inputs (left).
               The Outputs render their Outputs (right).
            */}

            {/* Render Outputs (Children) to the Right */}
            {outputAssets.length > 0 && depth >= 0 && (
                <div className="flex flex-col gap-8 items-start">
                    {outputAssets.map(outputAsset => (
                        <div key={outputAsset.id} className="flex items-center relative">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="w-8 h-px bg-border mx-2" />
                            <LineageNode asset={outputAsset} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            )}
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
