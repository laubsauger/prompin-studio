import React, { useMemo } from 'react';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AssetCard } from './AssetCard';
import type { Asset } from '../types';
import { ArrowRight } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

const InputNode: React.FC<{ asset: Asset }> = ({ asset }) => {
    const assets = useStore(state => state.assets);

    const inputAssets = useMemo(() => {
        if (!asset.metadata.inputs || asset.metadata.inputs.length === 0) return [];
        return asset.metadata.inputs
            .map(id => assets.find(a => a.id === id))
            .filter((a): a is Asset => !!a);
    }, [asset, assets]);

    return (
        <div className="flex items-center gap-8">
            {inputAssets.length > 0 && (
                <div className="flex flex-col gap-8 items-end">
                    {inputAssets.map(inputAsset => (
                        <div key={inputAsset.id} className="flex items-center relative">
                            <InputNode asset={inputAsset} />
                            <div className="w-8 h-px bg-border mx-2" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                    ))}
                </div>
            )}
            <div className="w-64">
                <AssetCard asset={asset} />
            </div>
        </div>
    );
};

const OutputNode: React.FC<{ asset: Asset }> = ({ asset }) => {
    const assets = useStore(state => state.assets);

    const outputAssets = useMemo(() => {
        return assets.filter(a => a.metadata.inputs?.includes(asset.id));
    }, [asset, assets]);

    return (
        <div className="flex items-center gap-8">
            <div className="w-64">
                <AssetCard asset={asset} />
            </div>
            {outputAssets.length > 0 && (
                <div className="flex flex-col gap-8 items-start">
                    {outputAssets.map(outputAsset => (
                        <div key={outputAsset.id} className="flex items-center relative">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="w-8 h-px bg-border mx-2" />
                            <OutputNode asset={outputAsset} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LineageTree: React.FC<{ rootAsset: Asset }> = ({ rootAsset }) => {
    const assets = useStore(state => state.assets);

    const inputAssets = useMemo(() => {
        if (!rootAsset.metadata.inputs || rootAsset.metadata.inputs.length === 0) return [];
        return rootAsset.metadata.inputs
            .map(id => assets.find(a => a.id === id))
            .filter((a): a is Asset => !!a);
    }, [rootAsset, assets]);

    const outputAssets = useMemo(() => {
        return assets.filter(a => a.metadata.inputs?.includes(rootAsset.id));
    }, [rootAsset, assets]);

    return (
        <div className="flex items-center gap-8">
            {/* Inputs (Left) */}
            {inputAssets.length > 0 && (
                <div className="flex flex-col gap-8 items-end">
                    {inputAssets.map(inputAsset => (
                        <div key={inputAsset.id} className="flex items-center relative">
                            <InputNode asset={inputAsset} />
                            <div className="w-8 h-px bg-border mx-2" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                    ))}
                </div>
            )}

            {/* Root */}
            <div className="relative group flex flex-col items-center">
                <div className="w-64 scale-110 ring-2 ring-primary ring-offset-2 rounded-xl transition-all duration-300">
                    <AssetCard asset={rootAsset} />
                </div>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                    Selected Asset
                </div>
            </div>

            {/* Outputs (Right) */}
            {outputAssets.length > 0 && (
                <div className="flex flex-col gap-8 items-start">
                    {outputAssets.map(outputAsset => (
                        <div key={outputAsset.id} className="flex items-center relative">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="w-8 h-px bg-border mx-2" />
                            <OutputNode asset={outputAsset} />
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
                            <LineageTree rootAsset={rootAsset} />
                        ) : (
                            <div className="text-muted-foreground">Asset not found</div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
