import React, { useRef, useState, useCallback } from 'react';
import { VirtuosoGrid, Virtuoso, type VirtuosoGridHandle, type VirtuosoHandle } from 'react-virtuoso';
import type { Asset } from '../types';
import { ExplorerCell } from './ExplorerCell';
import { AssetListItem } from './AssetListItem';
import { cn } from '../lib/utils';

interface AssetBrowserProps {
    assets: Asset[];
    viewMode: 'grid' | 'list';
    thumbnailSize: number;
    onAssetClick?: (asset: Asset) => void;
    selectedIds?: Set<string>;
    className?: string;
}

const GAP = 16;

export const AssetBrowser: React.FC<AssetBrowserProps> = ({
    assets,
    viewMode,
    thumbnailSize,
    onAssetClick,
    selectedIds,
    className
}) => {
    const virtuosoRef = useRef<VirtuosoGridHandle | VirtuosoHandle>(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
        // Show scroll indicator
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false);
        }, 800);

        // Calculate scroll progress (0-100) - account for visible range
        requestAnimationFrame(() => {
            const visibleCount = range.endIndex - range.startIndex;
            const maxScrollIndex = Math.max(1, assets.length - visibleCount);
            const progress = range.startIndex / maxScrollIndex;
            setScrollProgress(Math.min(100, Math.max(0, progress * 100)));
        });
    }, [assets.length]);

    // Wrapper to handle click and override default behavior if onAssetClick is provided
    const CellWrapper = ({ asset, children }: { asset: Asset, children: React.ReactNode }) => {
        const isSelected = selectedIds?.has(asset.id);

        return (
            <div
                className={cn(
                    "h-full relative",
                    isSelected && "ring-2 ring-primary rounded-lg"
                )}
                onClick={(e) => {
                    if (onAssetClick) {
                        e.stopPropagation();
                        e.preventDefault();
                        onAssetClick(asset);
                    }
                }}
            >
                {/* Overlay to intercept clicks in picker mode */}
                {onAssetClick && (
                    <div className="absolute inset-0 z-50 cursor-pointer" />
                )}
                {children}
            </div>
        );
    };

    if (assets.length === 0) {
        return (
            <div className={cn("flex h-full items-center justify-center text-muted-foreground", className)}>
                No assets found
            </div>
        );
    }

    return (
        <div className={cn("h-full relative", className)}>
            {viewMode === 'grid' ? (
                <VirtuosoGrid
                    ref={virtuosoRef as React.RefObject<VirtuosoGridHandle>}
                    style={{ height: '100%' }}
                    totalCount={assets.length}
                    rangeChanged={handleRangeChanged}
                    overscan={{ main: 1000, reverse: 1000 }}
                    components={{
                        List: React.forwardRef((props, ref) => (
                            <div
                                {...props}
                                ref={ref}
                                style={{
                                    ...(props as any).style,
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
                                    gap: `${GAP}px`,
                                    paddingBottom: '20px'
                                }}
                            />
                        )),
                        Item: (props) => (
                            <div {...props} style={{ ...props.style, margin: 0 }} />
                        )
                    }}
                    itemContent={(index) => {
                        const asset = assets[index];
                        return (
                            <CellWrapper asset={asset}>
                                <ExplorerCell
                                    asset={asset}
                                    setViewingAssetId={() => { }} // No-op in picker mode if onAssetClick is set
                                />
                            </CellWrapper>
                        );
                    }}
                />
            ) : (
                <Virtuoso
                    ref={virtuosoRef as React.RefObject<VirtuosoHandle>}
                    style={{ height: '100%' }}
                    totalCount={assets.length}
                    rangeChanged={handleRangeChanged}
                    overscan={{ main: 1000, reverse: 1000 }}
                    itemContent={(index) => {
                        const asset = assets[index];
                        return (
                            <div className="px-2 py-1">
                                <CellWrapper asset={asset}>
                                    <AssetListItem
                                        asset={asset}
                                        setViewingAssetId={() => { }}
                                    />
                                </CellWrapper>
                            </div>
                        );
                    }}
                />
            )}

            {/* Scroll Position Indicator */}
            {isScrolling && assets.length > 10 && (
                <div className="fixed right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-50" style={{ willChange: 'opacity' }}>
                    <div className="flex flex-col items-end gap-1">
                        <div className="bg-background/90 backdrop-blur-sm border border-border rounded px-2 py-1 shadow-lg text-xs font-medium">
                            {Math.round(scrollProgress)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
                            {assets.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
