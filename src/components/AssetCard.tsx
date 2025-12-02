import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { Film, Heart, Play, Pause, ZoomIn } from 'lucide-react';
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react';
import '@vidstack/react/player/styles/base.css';
import { MinimalVideoLayout } from './MinimalVideoLayout';


import { AssetContextMenu } from './AssetContextMenu';

export const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
    const toggleSelection = useStore(state => state.toggleSelection);
    const selectRange = useStore(state => state.selectRange);
    const toggleLike = useStore(state => state.toggleLike);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);

    const isSelected = useStore(state => state.selectedIds.has(asset.id));
    const [isPlaying, setIsPlaying] = useState(false);
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const playerRef = useRef<MediaPlayerInstance>(null);

    const handleClick = (e: React.MouseEvent) => {
        // Prevent click from propagating through overlay buttons
        if ((e.target as HTMLElement).closest('button')) return;
        if ((e.target as HTMLElement).closest('.vidstack-player')) return;
        if ((e.target as HTMLElement).closest('.overlay-controls')) return;

        if (e.shiftKey) {
            // Shift+click for range selection
            selectRange(asset.id);
        } else if (e.metaKey || e.ctrlKey) {
            // Cmd/Ctrl+click for multi-select
            toggleSelection(asset.id, true);
        } else {
            // Regular click opens preview
            setViewingAssetId(asset.id);
        }
    };

    const statusConfig = ASSET_STATUSES[asset.status] || ASSET_STATUSES.unsorted;

    const thumbnailSrc = asset.type === 'video' && asset.thumbnailPath
        ? `thumbnail://${asset.thumbnailPath}`
        : `media://${asset.path}`;

    const handlePlayPauseClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('[AssetCard] Play button clicked');

        if (isPlaying) {
            // This path shouldn't be reachable as button is hidden, but logging just in case
            console.log('[AssetCard] isPlaying is true, toggling pause');
            if (playerRef.current) {
                if (isVideoPaused) {
                    playerRef.current.play();
                    setIsVideoPaused(false);
                } else {
                    playerRef.current.pause();
                    setIsVideoPaused(true);
                }
            }
        } else {
            console.log('[AssetCard] Starting playback');
            setIsPlaying(true);
            setIsVideoPaused(false);
        }
    };

    return (
        <AssetContextMenu asset={asset}>
            <Card
                className={cn(
                    "group relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/50 bg-card/50",
                    isSelected && "ring-2 ring-primary border-primary shadow-lg bg-accent/10"
                )}
                onClick={handleClick}
            >
                <div className="aspect-square relative bg-muted/20">
                    {isPlaying && asset.type === 'video' ? (
                        <div className="absolute inset-0 z-20 vidstack-player bg-black">
                            <MediaPlayer
                                ref={playerRef}
                                src={`media://${asset.path}`}
                                viewType="video"
                                streamType="on-demand"
                                logLevel="warn"
                                crossOrigin
                                playsInline
                                className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
                                autoPlay
                                muted
                                onEnded={() => {
                                    console.log('[AssetCard] Video ended');
                                    setIsPlaying(false);
                                    setIsVideoPaused(false);
                                }}
                                onPause={() => {
                                    console.log('[AssetCard] Video paused');
                                    setIsVideoPaused(true);
                                }}
                                onPlay={() => {
                                    console.log('[AssetCard] Video playing');
                                    setIsVideoPaused(false);
                                }}
                                onError={(e) => {
                                    console.error('[AssetCard] Video error:', e);
                                }}
                            >
                                <MediaProvider className="w-full h-full [&_video]:object-cover" />
                                <MinimalVideoLayout />
                            </MediaPlayer>
                        </div>
                    ) : (
                        <>
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

                            {/* Inline Play/Pause Button */}
                            {asset.type === 'video' && (
                                <div className="absolute bottom-2 left-2 z-20 transition-opacity">
                                    <button
                                        onClick={handlePlayPauseClick}
                                        className="rounded-full p-2 bg-black/50 text-white hover:bg-primary hover:text-primary-foreground backdrop-blur-sm transition-colors"
                                    >
                                        {isPlaying && !isVideoPaused ? (
                                            <Pause className="h-3 w-3 fill-current" />
                                        ) : (
                                            <Play className="h-3 w-3 fill-current" />
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Magnifier for Images */}
                            {asset.type === 'image' && (
                                <div className="absolute bottom-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            useStore.getState().setViewingAssetId(asset.id);
                                        }}
                                        className="rounded-full p-2 bg-black/50 text-white hover:bg-primary hover:text-primary-foreground backdrop-blur-sm transition-colors"
                                    >
                                        <ZoomIn className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    <div className="absolute right-2 top-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity overlay-controls">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
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

                <div className="p-2 border-t border-border/50 flex flex-col gap-1 bg-card/80 backdrop-blur-sm min-h-[40px] justify-center">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5 shadow-none", statusConfig.color, "text-white border-none shrink-0")}>
                            {statusConfig.label}
                        </Badge>

                        {/* Tags Display */}
                        {asset.tags && asset.tags.map(tag => (
                            <div key={tag.id} className="flex items-center px-1.5 py-0.5 rounded-sm bg-accent/50 text-[10px] text-muted-foreground gap-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color || 'currentColor' }} />
                                {tag.name}
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        </AssetContextMenu >
    );
};
