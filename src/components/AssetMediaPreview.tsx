import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
import { cn } from '../lib/utils';
import { Film, Heart, Play, Pause, ZoomIn, GitBranch } from 'lucide-react';
import { AssetStatusBadge } from './AssetStatusBadge';

interface AssetMediaPreviewProps {
    asset: Asset;
    className?: string;
    showControls?: boolean;
    showStatus?: boolean;
    showTags?: boolean;
    autoPlay?: boolean;
    onPlayPause?: (isPlaying: boolean) => void;
}

export const AssetMediaPreview: React.FC<AssetMediaPreviewProps> = ({
    asset,
    className,
    showControls = true,
    showStatus = true,
    autoPlay = false,
    onPlayPause
}) => {
    const toggleLike = useStore(state => state.toggleLike);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);
    const filterConfig = useStore(state => state.filterConfig);

    const [isPlaying, setIsPlaying] = useState(autoPlay);
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
        if (!videoRef.current || !scrubberRef.current || asset.type !== 'video') return;
        if (isPlaying) return;

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

    useEffect(() => {
        if (onPlayPause) {
            onPlayPause(isPlaying);
        }
    }, [isPlaying, onPlayPause]);

    return (
        <div
            className={cn("relative bg-muted/20 w-full h-full overflow-hidden group", className)}
            onMouseEnter={() => setIsHoveringCard(true)}
            onMouseLeave={() => {
                setIsHoveringCard(false);
                if (isPlaying && !autoPlay) {
                    // Optional: pause on leave? AssetCard doesn't seem to force pause on leave unless intended
                    // Actually AssetCard keeps playing if toggled on.
                }
            }}
        >
            {asset.type === 'video' ? (
                <>
                    {(!isPlaying && !isHoveringScrubber) && (
                        <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                            {asset.thumbnailPath ? (
                                <img
                                    src={`thumbnail://${asset.thumbnailPath}`}
                                    alt={asset.path}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                    <Film className="w-8 h-8 opacity-50" />
                                    <span className="text-xs opacity-50">Generating...</span>
                                </div>
                            )}
                        </div>
                    )}

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
                            muted={!isPlaying}
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
                            if (scrubberRef.current) {
                                const rect = scrubberRef.current.getBoundingClientRect();
                                const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                                setHoverProgress((x / rect.width) * 100);
                            }
                        }}
                    >
                        <div className="w-full h-1 bg-white/20 group-hover/scrubber:bg-white/30 group-hover/scrubber:h-1.5 transition-all rounded-full overflow-hidden backdrop-blur-sm relative">
                            <div
                                className="absolute top-0 left-0 bottom-0 bg-primary/80 transition-all duration-75"
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            />
                        </div>

                        {hoverProgress !== null && (
                            <div
                                className="absolute h-3 w-2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)] z-10 pointer-events-none border border-black/20 rounded-[1px] top-1/2 -translate-y-1/2"
                                style={{ left: `${hoverProgress}%`, transform: 'translate(-50%, -25%)' }}
                            />
                        )}
                    </div>

                    {/* Time Display */}
                    <div className="absolute bottom-2 right-2 z-30 text-[9px] font-medium text-white/90 bg-black/40 px-1.5 py-0.5 rounded-sm backdrop-blur-sm pointer-events-none tabular-nums">
                        {(isPlaying || isHoveringCard)
                            ? `${formatTime((isHoveringScrubber && hoverProgress !== null) ? ((hoverProgress / 100) * (duration || asset.metadata.duration || 0)) : currentTime)} / ${formatTime(duration || asset.metadata.duration || 0)}`
                            : formatTime(duration || asset.metadata.duration || 0)
                        }
                    </div>
                </>
            ) : (
                <img
                    src={thumbnailSrc}
                    alt={asset.path}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                />
            )}

            {/* Inline Play/Pause Button */}
            {asset.type === 'video' && !isHoveringScrubber && (
                <div
                    className="absolute bottom-3.5 left-2 z-50 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handlePlayPauseClick}
                        className="rounded-full p-2.5 bg-black/50 text-white hover:bg-primary hover:text-primary-foreground backdrop-blur-sm transition-colors"
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
                            setViewingAssetId(asset.id);
                        }}
                        className="rounded-full p-2 bg-black/50 text-white hover:bg-primary hover:text-primary-foreground backdrop-blur-sm transition-colors"
                    >
                        <ZoomIn className="h-3 w-3" />
                    </button>
                </div>
            )}

            {/* Status badge */}
            {showStatus && (
                <div className="absolute top-2 left-2 z-10">
                    <AssetStatusBadge status={asset.status} />
                </div>
            )}

            {/* Overlay Controls (Like, Lineage) */}
            {showControls && (
                <div className={cn(
                    "absolute right-2 top-2 z-10 flex gap-2 overlay-controls transition-opacity duration-200",
                    isHoveringScrubber ? "opacity-0" : "opacity-100"
                )}>
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
                                ? "bg-black/40 text-red-500 hover:bg-black/60"
                                : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white"
                        )}
                    >
                        <Heart className={cn("h-3.5 w-3.5", asset.metadata.liked && "fill-current")} />
                    </button>
                </div>
            )}

            {/* Similarity Score */}
            {filterConfig.relatedToAssetId && filterConfig.semantic && (
                <div className="absolute bottom-2 left-2 z-50 text-[10px] font-bold text-white/90 bg-black/60 px-1.5 py-0.5 rounded-sm backdrop-blur-sm pointer-events-none tabular-nums border border-white/10">
                    {asset.distance !== undefined ? `${Math.round((1 - asset.distance) * 100)}%` : 'N/A'}
                </div>
            )}
        </div>
    );
};
