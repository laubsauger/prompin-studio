import React from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { ASSET_STATUSES, STATUS_OPTIONS } from '../config/constants';
import { cn } from '../lib/utils';
import { MessageSquare, Film, Image as ImageIcon, Heart } from 'lucide-react';

export const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
    const { updateAssetStatus, addComment, updateMetadata, toggleSelection, selectRange, toggleLike } = useStore();
    const isSelected = useStore(state => state.selectedIds.has(asset.id));

    const handleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('select, input, button')) return;

        if (e.shiftKey) {
            selectRange(asset.id);
        } else {
            toggleSelection(asset.id, e.metaKey || e.ctrlKey);
        }
    };

    const statusConfig = ASSET_STATUSES[asset.status] || ASSET_STATUSES.unsorted;

    return (
        <Card
            className={cn(
                "overflow-hidden transition-all duration-200 group relative border-border bg-card/50 hover:bg-card",
                isSelected && "ring-2 ring-primary border-primary"
            )}
            onClick={handleClick}
        >
            <div className="relative aspect-video bg-muted">
                {asset.type === 'image' ? (
                    <img
                        src={`file://${asset.path}`}
                        alt={asset.path}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Film className="h-12 w-12" />
                    </div>
                )}

                <div className="absolute right-2 top-2 z-10 flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(asset.id);
                        }}
                        className={cn(
                            "rounded-full p-1.5 backdrop-blur-md transition-colors",
                            asset.metadata.liked
                                ? "bg-red-500/80 text-white hover:bg-red-600/80"
                                : "bg-black/20 text-white/70 hover:bg-black/40 hover:text-white"
                        )}
                    >
                        <Heart className={cn("h-3.5 w-3.5", asset.metadata.liked && "fill-current")} />
                    </button>
                    <Badge variant="secondary" className={cn("shadow-sm backdrop-blur-md", statusConfig.color, "text-white border-none")}>
                        {statusConfig.label}
                    </Badge>
                </div>

                {isSelected && (
                    <div className="absolute inset-0 z-0 bg-primary/10 pointer-events-none" />
                )}
            </div>

            <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground truncate" title={asset.path}>
                        {asset.path}
                    </p>
                    {asset.type === 'image' && <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
                </div>

                <Select
                    value={asset.status}
                    onChange={(e) => updateAssetStatus(asset.id, e.target.value as any)}
                    className="h-8 text-xs"
                >
                    {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Select>

                <div className="grid grid-cols-3 gap-1">
                    {['project', 'scene', 'shot'].map((field) => (
                        <Input
                            key={field}
                            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                            defaultValue={(asset.metadata as any)[field] || ''}
                            onBlur={(e) => updateMetadata(asset.id, field, e.target.value)}
                            className="h-6 px-1 text-[10px] bg-background/50"
                        />
                    ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                    {asset.metadata.comments && asset.metadata.comments.length > 0 && (
                        <div className="max-h-16 overflow-y-auto space-y-1">
                            {asset.metadata.comments.map(c => (
                                <div key={c.id} className="text-[10px] text-muted-foreground bg-muted/50 p-1 rounded">
                                    <span className="font-semibold text-foreground">{c.authorId}:</span> {c.text}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="relative">
                        <Input
                            placeholder="Add comment..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    addComment(asset.id, e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }
                            }}
                            className="h-7 pr-7 text-xs bg-background/50"
                        />
                        <MessageSquare className="absolute right-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
