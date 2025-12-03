import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { Film, Heart, Play, Pause, ZoomIn, GitBranch } from 'lucide-react';


import { AssetContextMenu } from './AssetContextMenu';

export const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
    const toggleSelection = useStore(state => state.toggleSelection);
    const selectRange = useStore(state => state.selectRange);
    const toggleLike = useStore(state => state.toggleLike);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);

    const isSelected = useStore(state => state.selectedIds.has(asset.id));
    const aspectRatio = useStore(state => state.aspectRatio);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
    const [isHoveringCard, setIsHoveringCard] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const scrubberRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        // Prevent click from propagating through overlay buttons
        if ((e.target as HTMLElement).closest('button')) return;
        if ((e.target as HTMLElement).closest('video')) return;
        if ((e.target as HTMLElement).closest('.overlay-controls')) return;
        if ((e.target as HTMLElement).closest('.scrubber-bar')) return;

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

    const handlePlayPauseClick = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (!videoRef.current || asset.type !== 'video') return;

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch((err) => {
                console.error('Failed to play video:', err);
            });
        }
    }, [isPlaying, asset.type]);

    const handleScrub = useCallback((e: React.MouseEvent) => {
        if (!videoRef.current || !scrubberRef.current || asset.type !== 'video') return;

        const rect = scrubberRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;

        const duration = videoRef.current.duration;
        if (duration && Number.isFinite(duration)) {
            videoRef.current.currentTime = duration * percentage;
        }
    }, [asset.type]);

    const aspectRatioClass = {
        square: 'aspect-square',
        video: 'aspect-video',
        portrait: 'aspect-[9/16]'
    }[aspectRatio];

    return (
        <AssetContextMenu asset={asset}>
            <Card
                className={cn(
                    "group relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/50 bg-card/50",
                    isSelected && "ring-2 ring-primary border-primary shadow-lg bg-accent/10"
                )}
                onClick={handleClick}
                onMouseEnter={() => setIsHoveringCard(true)}
                onMouseLeave={() => {
                    setIsHoveringCard(false);
                    // Pause video when leaving card if it was only playing due to hover/scrub interaction?
                    // For now, let's leave explicit play/pause behavior alone, but maybe pause if it was just scrubbing?
                    // Actually, if we stop rendering the video on mouse leave (unless isPlaying), it will stop anyway.
                }}
            >
                <div className={cn("relative bg-muted/20 bg-black", aspectRatioClass)}>
                    {asset.type === 'video' ? (
                        <>
                            {/* Show thumbnail when not playing AND not scrubbing */}
                            {(!isPlaying && !isHoveringScrubber) && (
                                !asset.thumbnailPath ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                        <Film className="w-8 h-8 opacity-50" />
                                    </div>
                                ) : (
                                    <img
                                        src={thumbnailSrc}
                                        alt={asset.path}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                )
                            )}

                            {/* Native Video Element - Only render if playing or hovering card (for warmup) */}
                            {(isPlaying || isHoveringCard) && (
                                <video
                                    ref={videoRef}
                                    src={`media://${asset.path}`}
                                    className={cn(
                                        "absolute inset-0 z-20 w-full h-full object-contain bg-black transition-opacity duration-200",
                                        (!isPlaying && !isHoveringScrubber) ? "opacity-0 pointer-events-none" : "opacity-100"
                                    )}
                                    playsInline
                                    muted={!isPlaying} // Mute when just previewing/scrubbing? Or maybe always unmute if user explicitly plays?
                                    // Let's keep it simple: if isPlaying is true, we want sound. If scrubbing, maybe we want sound too?
                                    // Usually scrubbing previews are muted.
                                    // But handlePlayPauseClick toggles isPlaying.
                                    // So if !isPlaying (scrubbing), it should probably be muted.
                                    loop
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onEnded={() => setIsPlaying(false)}
                                    onClick={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                />
                            )}

                            {/* Scrubber Bar */}
                            <div
                                ref={scrubberRef}
                                className="absolute bottom-0 left-0 right-0 h-6 z-40 cursor-ew-resize flex items-end group/scrubber scrubber-bar px-1 pb-1"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={() => setIsHoveringScrubber(true)}
                                onMouseLeave={() => setIsHoveringScrubber(false)}
                                onMouseMove={handleScrub}
                            >
                                <div className="w-full h-1 bg-white/20 group-hover/scrubber:bg-white/30 group-hover/scrubber:h-1.5 transition-all rounded-full overflow-hidden backdrop-blur-sm relative">
                                    {/* Progress indicator could go here */}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Image handling */
                        <img
                            src={thumbnailSrc}
                            alt={asset.path}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                        />
                    )}

                    {/* Inline Play/Pause Button - Always visible for videos, unless scrubbing */}
                    {asset.type === 'video' && !isHoveringScrubber && (
                        <div
                            className="absolute bottom-2 left-2 z-30 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={handlePlayPauseClick}
                                className="rounded-full p-2 bg-black/50 text-white hover:bg-primary hover:text-primary-foreground backdrop-blur-sm transition-colors"
                            >
                                {isPlaying ? (
                                    <Pause className="h-3 w-3 fill-current" />
                                ) : (
                                    <Play className="h-3 w-3 fill-current" />
                                )}
                            </button>
                        </div>
                    )}

                    {/* Magnifier for Images */}
                    {asset.type === 'image' && (
                        <div className="absolute bottom-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
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

                    <div className={cn(
                        "absolute right-2 top-2 z-10 flex gap-2 overlay-controls transition-opacity duration-200",
                        isHoveringScrubber ? "opacity-0" : "opacity-100"
                    )}>
                        {/* Lineage indicator - shows if asset has input images */}
                        {asset.metadata.inputs && asset.metadata.inputs.length > 0 && (
                            <div
                                className="rounded-full p-1.5 bg-black/40 text-white/90 backdrop-blur-md"
                                title={`Has ${asset.metadata.inputs.length} input asset${asset.metadata.inputs.length > 1 ? 's' : ''}`}
                            >
                                <GitBranch className="h-3.5 w-3.5" />
                            </div>
                        )}

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

                    {/* New Indicator for Inbox */}
                    {asset.status === 'unsorted' && asset.createdAt > useStore.getState().lastInboxViewTime && (
                        <div className="absolute top-2 left-2 z-20">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full border border-white shadow-sm ring-1 ring-black/10" />
                        </div>
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
