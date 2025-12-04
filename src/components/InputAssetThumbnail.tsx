import React from 'react';
import { X, Film, Image, Maximize2 } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "./ui/context-menu";
import { AssetMenuActions } from './AssetMenuActions';
import type { Asset } from '../types';

interface InputAssetThumbnailProps {
    assetId: string;
    onRemove: () => void;
    className?: string;
}

export const InputAssetThumbnail: React.FC<InputAssetThumbnailProps> = ({
    assetId,
    onRemove,
    className
}) => {
    const storeAsset = useStore(state => state.assets.find(a => a.id === assetId));
    const setViewingAssetId = useStore(state => state.setViewingAssetId);
    const setInspectorAsset = useStore(state => state.setInspectorAsset);
    const [fetchedAsset, setFetchedAsset] = React.useState<Asset | null>(null);
    const [isContextMenuOpen, setIsContextMenuOpen] = React.useState(false);

    React.useEffect(() => {
        if (!storeAsset && !fetchedAsset) {
            // Fetch if not in store
            const ipc = (window as any).ipcRenderer;
            if (ipc) {
                ipc.invoke('get-asset', assetId).then((asset: Asset) => {
                    if (asset) setFetchedAsset(asset);
                }).catch((err: any) => console.error('Failed to fetch input asset:', err));
            }
        }
    }, [assetId, storeAsset, fetchedAsset]);

    const asset = storeAsset || fetchedAsset;

    const handleFullscreen = () => {
        if (asset) {
            setViewingAssetId(asset.id);
        }
    };

    const handleInspect = () => {
        if (asset) {
            setInspectorAsset(asset.id);
        }
    };

    if (!asset) {
        return (
            <div className={cn(
                "relative group w-24 h-24 rounded-lg border bg-muted/30 flex items-center justify-center",
                className
            )}>
                <span className="text-xs text-muted-foreground">Loading...</span>
                <button
                    onClick={onRemove}
                    className="absolute -top-2 -right-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        );
    }

    const isVideo = asset.type === 'video';
    const thumbnailUrl = isVideo && asset.thumbnailPath
        ? `thumbnail://${asset.thumbnailPath}`
        : `media://${asset.path}`;

    const fileName = asset.path.split('/').pop() || '';
    const displayName = fileName.length > 15
        ? fileName.substring(0, 12) + '...'
        : fileName;

    return (
        <ContextMenu onOpenChange={setIsContextMenuOpen}>
            <ContextMenuTrigger>
                <div className={cn(
                    "relative group flex flex-col items-center gap-1",
                    className
                )}>
                    <div className={cn(
                        "relative w-24 h-24 rounded-lg border bg-background overflow-hidden transition-all cursor-pointer",
                        "hover:ring-2 hover:ring-primary/50",
                        isContextMenuOpen && "ring-2 ring-primary"
                    )}>
                        {/* Thumbnail */}
                        <img
                            src={thumbnailUrl}
                            alt={fileName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Fallback for broken images
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                            onClick={handleInspect}
                        />

                        {/* Fallback icon */}
                        <div className="hidden absolute inset-0 flex items-center justify-center bg-muted/50">
                            {isVideo ? (
                                <Film className="h-8 w-8 text-muted-foreground" />
                            ) : (
                                <Image className="h-8 w-8 text-muted-foreground" />
                            )}
                        </div>

                        {/* Type indicator badge */}
                        <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
                            {isVideo ? (
                                <Film className="h-3 w-3 text-white" />
                            ) : (
                                <Image className="h-3 w-3 text-white" />
                            )}
                            <span className="text-[10px] text-white uppercase font-medium">
                                {asset.type}
                            </span>
                        </div>

                        {/* Action buttons overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleFullscreen();
                                }}
                                className="p-1.5 bg-white/90 hover:bg-white text-black rounded-md transition-colors"
                                title="View fullscreen"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Remove button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            className="absolute -top-2 -right-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                            title="Remove"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>

                    {/* File name */}
                    <span
                        className="text-xs text-muted-foreground max-w-24 truncate px-1"
                        title={fileName}
                    >
                        {displayName}
                    </span>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem onClick={handleFullscreen}>
                    <Maximize2 className="mr-2 h-4 w-4" />
                    View Fullscreen
                </ContextMenuItem>
                <ContextMenuItem onClick={handleInspect}>
                    <X className="mr-2 h-4 w-4" />
                    Inspect Asset
                </ContextMenuItem>
                <ContextMenuSeparator />
                <AssetMenuActions
                    asset={asset}
                    components={{
                        Item: ContextMenuItem,
                        Separator: ContextMenuSeparator,
                        Sub: ContextMenuSub,
                        SubTrigger: ContextMenuSubTrigger,
                        SubContent: ContextMenuSubContent,
                    }}
                />
            </ContextMenuContent>
        </ContextMenu>
    );
};