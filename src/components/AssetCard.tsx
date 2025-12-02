import React from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { Film, Image as ImageIcon, Heart } from 'lucide-react';

export const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
    const { toggleSelection, selectRange, toggleLike } = useStore();
    const isSelected = useStore(state => state.selectedIds.has(asset.id));

    const handleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;

        if (e.shiftKey) {
            selectRange(asset.id);
        } else {
            toggleSelection(asset.id, e.metaKey || e.ctrlKey);
        }
    };

    const statusConfig = ASSET_STATUSES[asset.status] || ASSET_STATUSES.unsorted;

    const thumbnailSrc = asset.type === 'video' && asset.thumbnailPath
        ? `thumbnail://${asset.thumbnailPath}`
        : `media://${asset.path}`;

    return (
        <Card
            className={cn(
                "group relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/50 bg-card/50",
                isSelected && "ring-2 ring-primary border-primary shadow-lg bg-accent/10"
            )}
            onClick={handleClick}
        >
            <div className="aspect-square relative bg-muted/20">
                {asset.type === 'video' && !asset.thumbnailPath ? (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <Film className="w-8 h-8 opacity-50" />
                    </div>
                ) : (
                    <img
                        src={thumbnailSrc}
                        alt={asset.path}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                )}

                <div className="absolute right-2 top-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(asset.id);
                        }}
                        className={cn(
                            "rounded-full p-1.5 backdrop-blur-md transition-colors",
                            asset.metadata.liked
                                ? "bg-red-500/80 text-white hover:bg-red-600/80"
                                : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white"
                        )}
                    >
                        <Heart className={cn("h-3.5 w-3.5", asset.metadata.liked && "fill-current")} />
                    </button>
                </div>

                {isSelected && (
                    <div className="absolute inset-0 z-0 bg-primary/10 pointer-events-none" />
                )}
            </div>

            <div className="p-2 border-t border-border/50 flex items-center justify-between gap-2 bg-card/80 backdrop-blur-sm">
                <div className="flex items-center gap-2 min-w-0">
                    {asset.type === 'image' ?
                        <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" /> :
                        <Film className="h-3 w-3 text-muted-foreground shrink-0" />
                    }
                    <span className="text-xs font-medium text-muted-foreground truncate" title={asset.path}>
                        {asset.path.split('/').pop()}
                    </span>
                </div>
                <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5 shadow-none", statusConfig.color, "text-white border-none shrink-0")}>
                    {statusConfig.label}
                </Badge>
            </div>
        </Card>
    );
};
