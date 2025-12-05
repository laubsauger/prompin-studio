import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import type { Asset } from '../types';
import { Card } from './ui/card';

import { cn } from '../lib/utils';
import { Film, Heart, Play, Pause, ZoomIn, GitBranch } from 'lucide-react';


import { AssetContextMenu } from './AssetContextMenu';
import { AssetStatusBadge } from './AssetStatusBadge';

export const AssetCard: React.FC<{ asset: Asset }> = React.memo(({ asset }) => {
    const toggleSelection = useStore(state => state.toggleSelection);
    const selectRange = useStore(state => state.selectRange);
    const toggleLike = useStore(state => state.toggleLike);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);
    const setInspectorAsset = useStore(state => state.setInspectorAsset);
    const inspectorCollapsed = useSettingsStore(state => state.inspectorCollapsed);
    const toggleInspector = useSettingsStore(state => state.toggleInspector);

    const isSelected = useStore(state => state.selectedIds.has(asset.id));
    const isInInspector = useStore(state => state.inspectorAsset?.id === asset.id);
    const aspectRatio = useStore(state => state.aspectRatio);
    const viewDisplay = useStore(state => state.viewDisplay);
    const relatedToAssetId = useStore(state => state.filterConfig.relatedToAssetId);
    const isSemantic = useStore(state => state.filterConfig.semantic);

    if (asset.type === 'image' && asset.distance === undefined && relatedToAssetId) {
        // console.log('Image missing distance:', asset.id);
    }

    // console.log('AssetCard render:', asset.id, asset.distance);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
    const [isHoveringCard, setIsHoveringCard] = useState(false);
    const [duration, setDuration] = useState(asset.metadata.duration || 0);
    const [currentTime, setCurrentTime] = useState(0);
    const [hoverProgress, setHoverProgress] = useState<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const scrubberRef = useRef<HTMLDivElement>(null);

    const formatTime = (seconds: number) => {
        if (!Number.isFinite(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify({ assetId: asset.id }));

        // Create a custom drag image with fixed size
        if (e.dataTransfer.setDragImage) {
            const dragImage = document.createElement('div');
            dragImage.style.position = 'fixed';
            dragImage.style.top = '-1000px';
            dragImage.style.left = '-1000px';
            dragImage.style.width = '150px';
            dragImage.style.height = '150px';
            dragImage.style.background = 'rgba(0, 0, 0, 0.8)';
            dragImage.style.borderRadius = '8px';
            dragImage.style.display = 'flex';
            dragImage.style.alignItems = 'center';
            dragImage.style.justifyContent = 'center';
            dragImage.style.flexDirection = 'column';
            dragImage.style.padding = '12px';
            dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';

            // Add thumbnail
            const img = document.createElement('img');
            img.src = asset.type === 'video' && asset.thumbnailPath
                ? `thumbnail://${asset.thumbnailPath}`
                : `media://${asset.path}`;
            img.style.width = '100%';
            img.style.height = '100px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.marginBottom = '8px';

            // Add filename
            const label = document.createElement('div');
            label.textContent = asset.path.split('/').pop() || '';
            label.style.color = 'white';
            label.style.fontSize = '11px';
            label.style.textAlign = 'center';
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.whiteSpace = 'nowrap';
            label.style.width = '100%';

            dragImage.appendChild(img);
            dragImage.appendChild(label);
            document.body.appendChild(dragImage);

            // Set the custom drag image
            e.dataTransfer.setDragImage(dragImage, 75, 75);

            // Clean up after a short delay
            setTimeout(() => {
                if (document.body.contains(dragImage)) {
                    document.body.removeChild(dragImage);
                }
            }, 0);
        }
    };

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
            // Regular click: Open preview ONLY (do not select)
            setViewingAssetId(asset.id);
        }
    };



    const thumbnailSrc = asset.thumbnailPath
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
        // Only allow hover scrubbing if NOT playing to avoid conflict
        if (!videoRef.current || !scrubberRef.current || asset.type !== 'video') return;
        if (isPlaying) return;

        // Check if metadata is loaded
        if (videoRef.current.readyState < 1) return;

        const rect = scrubberRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;

        const duration = videoRef.current.duration;
        if (duration && Number.isFinite(duration)) {
            videoRef.current.currentTime = duration * percentage;
        }
    }, [asset.type, isPlaying]);

    const handleSeek = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!videoRef.current || !scrubberRef.current || asset.type !== 'video') return;

        const rect = scrubberRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;

        const duration = videoRef.current.duration;
        if (duration && Number.isFinite(duration)) {
            videoRef.current.currentTime = duration * percentage;
            videoRef.current.play().catch(err => console.error("Failed to play on seek:", err));
            setIsPlaying(true);
        }
    }, [asset.type]);

    const aspectRatioClass = {
        square: 'aspect-square',
        video: 'aspect-video',
        portrait: 'aspect-[9/16]'
    }[aspectRatio];

    return (
        <AssetContextMenu asset={asset}>
            <div className="relative">
                {/* New Indicator for Inbox - Outside overflow container */}
                {asset.status === 'unsorted' && asset.createdAt > useStore.getState().lastInboxViewTime && (
                    <div className="absolute -top-0.5 -left-0.5 z-20">
                        <div className="relative">
                            {/* Subtle pulsing glow effect */}
                            <div className="absolute inset-0 w-2.5 h-2.5 bg-green-500/30 rounded-full animate-ping" />
                            {/* Stable dot with solid border */}
                            <div className="relative w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background shadow-md ring-1 ring-green-500/20" />
                        </div>
                    </div>
                )}

                <Card
                    className={cn(
                        "group relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/50 bg-card/50",
                        isSelected && "ring-2 ring-primary border-primary shadow-lg bg-accent/10",
                        // Highlight source asset in similarity search
                        asset.id === relatedToAssetId && !isSelected && "border-2 border-purple-500 shadow-lg",
                        // Highlight asset shown in inspector
                        isInInspector && !isSelected && "border-2 border-orange-500/70 shadow-md"
                    )}
                    draggable
                    onDragStart={handleDragStart}
                    onClick={handleClick}
                    onMouseEnter={() => setIsHoveringCard(true)}
                    onMouseLeave={() => {
                        setIsHoveringCard(false);
                    }}
                >
                    {/* Source Asset Label */}
                    {asset.id === relatedToAssetId && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-b-sm font-medium shadow-sm leading-none">
                            Source
                        </div>
                    )}

                    {/* Inspector Label */}
                    {isInInspector && !isSelected && (
                        <div className="absolute top-0 right-2 z-20 bg-orange-500/90 text-white text-[8px] px-1.5 py-0.5 rounded-b-sm font-medium shadow-sm leading-none">
                            Inspecting
                        </div>
                    )}

                    <div className={cn("relative bg-muted/20", aspectRatioClass)}>
                        {asset.type === 'video' ? (
                            <>
                                {/* Show thumbnail when not playing AND not scrubbing */}
                                {(!isPlaying && !isHoveringScrubber) && (
                                    <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                                        {asset.thumbnailPath ? (
                                            <img
                                                src={`thumbnail://${asset.thumbnailPath}`}
                                                alt={asset.path}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Film className="w-8 h-8 opacity-50" />
                                                <span className="text-xs opacity-50">Generating...</span>
                                            </div>
                                        )}
                                        {/* Magnifier Icon for Images - Not needed for video here as this block is inside asset.type === 'video' check */}
                                    </div>
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
                                        preload="metadata"
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
                                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                    />
                                )}

                                {/* Scrubber Bar */}
                                <div
                                    ref={scrubberRef}
                                    className="absolute bottom-0 left-0 right-0 h-1.5 z-40 cursor-ew-resize flex items-center group/scrubber scrubber-bar"
                                    onMouseDown={handleSeek}
                                    onMouseEnter={() => setIsHoveringScrubber(true)}
                                    onMouseLeave={() => {
                                        setIsHoveringScrubber(false);
                                        setHoverProgress(null);
                                    }}
                                    onMouseMove={(e) => {
                                        handleScrub(e);
                                        // Update hover progress for visual indicator
                                        if (scrubberRef.current) {
                                            const rect = scrubberRef.current.getBoundingClientRect();
                                            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                                            setHoverProgress((x / rect.width) * 100);
                                        }
                                    }}
                                >
                                    <div className="w-full h-1 bg-white/20 group-hover/scrubber:bg-white/30 group-hover/scrubber:h-1.5 transition-all rounded-full overflow-hidden relative">
                                        {/* Playback Progress */}
                                        <div
                                            className="absolute top-0 left-0 bottom-0 bg-primary/80 transition-all duration-75"
                                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                        />
                                    </div>

                                    {/* Hover Indicator - Moved outside to avoid clipping and allow full height */}
                                    {hoverProgress !== null && (
                                        <div
                                            className="absolute h-3 w-2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)] z-10 pointer-events-none border border-black/20 rounded-[1px] top-1/2 -translate-y-1/2"
                                            style={{ left: `${hoverProgress}%`, transform: 'translate(-50%, -25%)' }}
                                        />
                                    )}
                                </div>

                                {/* Time Display */}
                                {asset.type === 'video' && (
                                    <div className="absolute bottom-2 right-2 z-30 text-[9px] font-medium text-white/90 bg-black/60 px-1.5 py-0.5 rounded-sm pointer-events-none tabular-nums">
                                        {(isPlaying || isHoveringCard)
                                            ? `${formatTime((isHoveringScrubber && hoverProgress !== null) ? ((hoverProgress / 100) * (duration || asset.metadata.duration || 0)) : currentTime)} / ${formatTime(duration || asset.metadata.duration || 0)}`
                                            : formatTime(duration || asset.metadata.duration || 0)
                                        }
                                    </div>
                                )}
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
                                className="absolute bottom-3.5 left-2 z-50 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={handlePlayPauseClick}
                                    className="rounded-full p-2.5 bg-black/60 text-white hover:bg-primary hover:text-primary-foreground transition-colors"
                                >
                                    {isPlaying ? (
                                        <Pause className="h-4 w-4 fill-current" />
                                    ) : (
                                        <Play className="h-4 w-4 fill-current" />
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
                                    className="rounded-full p-2 bg-black/60 text-white hover:bg-primary hover:text-primary-foreground transition-colors"
                                >
                                    <ZoomIn className="h-3 w-3" />
                                </button>
                            </div>
                        )}

                        {/* Status badge - top left overlay, only show in detailed view */}
                        {viewDisplay === 'detailed' && (
                            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                                <AssetStatusBadge status={asset.status} />
                                {/* Similarity Score - Only show when in similarity search mode */}
                                {relatedToAssetId && isSemantic && (
                                    <div className="text-[10px] font-bold text-white/90 bg-black/70 px-1.5 py-0.5 rounded-sm tabular-nums border border-white/10 w-fit">
                                        {asset.distance !== undefined ? `${Math.round((1 - asset.distance) * 100)}%` : 'N/A'}
                                    </div>
                                )}
                            </div>
                        )}

                        {viewDisplay === 'detailed' && (
                            <div className={cn(
                                "absolute right-2 top-2 z-10 flex gap-2 overlay-controls transition-opacity duration-200",
                                isHoveringScrubber ? "opacity-0" : "opacity-100"
                            )}>
                                {/* Lineage indicator - shows if asset has input images */}
                                {asset.metadata.inputs && asset.metadata.inputs.length > 0 && (
                                    <div
                                        className="rounded-full p-1.5 bg-black/60 text-white/90"
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
                                        "rounded-full p-1.5 transition-colors",
                                        asset.metadata.liked
                                            ? "bg-black/60 text-red-500 hover:bg-black/80"
                                            : "bg-black/60 text-white/70 hover:bg-black/80 hover:text-white"
                                    )}
                                >
                                    <Heart className={cn("h-3.5 w-3.5", asset.metadata.liked && "fill-current")} />
                                </button>
                            </div>
                        )}

                        {isSelected && (
                            <div className="absolute inset-0 z-0 bg-primary/10 pointer-events-none" />
                        )}
                    </div>

                    {/* Tags section - only show in detailed view */}
                    {viewDisplay === 'detailed' && (
                        <div
                            className="border-t border-border/50 bg-card/90 h-7 relative overflow-hidden group/tags cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                setInspectorAsset(asset);
                                // Expand inspector if it's collapsed
                                if (inspectorCollapsed) {
                                    toggleInspector();
                                }
                            }}
                        >
                            <div className="flex items-center gap-1 px-2 h-full">
                                {/* Tags Display with stacking */}
                                {asset.tags && asset.tags.length > 0 ? (
                                    <>
                                        {asset.tags.slice(0, 3).map((tag, index) => (
                                            <div
                                                key={tag.id}
                                                className={cn(
                                                    "flex items-center px-1.5 py-0.5 rounded-sm bg-accent/50 text-[10px] text-muted-foreground gap-1 shrink-0",
                                                    index > 0 && "-ml-2"
                                                )}
                                                style={{ zIndex: asset.tags!.length - index }}
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color || 'currentColor' }} />
                                                <span className="max-w-[60px] truncate">{tag.name}</span>
                                            </div>
                                        ))}
                                        {asset.tags.length > 3 && (
                                            <div className="flex items-center px-1.5 py-0.5 rounded-sm bg-accent/70 text-[10px] text-muted-foreground -ml-2">
                                                +{asset.tags.length - 3}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-[10px] text-muted-foreground/40">No tags</div>
                                )}
                            </div>

                            {/* Hover tooltip showing all tags */}
                            {asset.tags && asset.tags.length > 0 && (
                                <div className="absolute inset-x-0 top-full mt-1 bg-popover/95 border border-border rounded-md p-2 opacity-0 pointer-events-none group-hover/tags:opacity-100 group-hover/tags:pointer-events-auto transition-opacity z-50 shadow-lg">
                                    <div className="flex flex-wrap gap-1">
                                        {asset.tags.map(tag => (
                                            <div key={tag.id} className="flex items-center px-2 py-1 rounded-sm bg-accent text-[11px] text-foreground gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || 'currentColor' }} />
                                                {tag.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </AssetContextMenu >
    );
});

AssetCard.displayName = 'AssetCard';
