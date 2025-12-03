import React, { useMemo, useRef } from 'react';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AssetCard } from './AssetCard';
import type { Asset } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Home } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Button } from './ui/button';

// Simplified graph layout for better performance

// Simplified graph layout for better performance
const LineageGraph: React.FC<{ rootAsset: Asset, lineageAssets: Asset[] }> = ({ rootAsset, lineageAssets }) => {
    // Calculate node positions using a simple force-directed-like layout
    const nodePositions = useMemo(() => {
        const positions = new Map<string, { x: number; y: number; level: number }>();
        const visited = new Set<string>();

        // Position root at center
        positions.set(rootAsset.id, { x: 0, y: 0, level: 0 });
        visited.add(rootAsset.id);

        // Position inputs to the left with more spacing
        const inputQueue: { asset: Asset; level: number }[] = [];
        if (rootAsset.metadata.inputs) {
            rootAsset.metadata.inputs.forEach((inputId, index) => {
                const inputAsset = lineageAssets.find(a => a.id === inputId);
                if (inputAsset && !visited.has(inputId)) {
                    const yOffset = (index - (rootAsset.metadata.inputs!.length - 1) / 2) * 300; // Vertical spacing
                    positions.set(inputId, { x: -350, y: yOffset, level: -1 }); // Horizontal spacing
                    visited.add(inputId);
                    inputQueue.push({ asset: inputAsset, level: -1 });
                }
            });
        }

        // Recursively position input ancestors with more spacing
        while (inputQueue.length > 0) {
            const { asset, level } = inputQueue.shift()!;
            if (asset.metadata.inputs) {
                asset.metadata.inputs.forEach((inputId, index) => {
                    const inputAsset = lineageAssets.find(a => a.id === inputId);
                    if (inputAsset && !visited.has(inputId)) {
                        const parentPos = positions.get(asset.id)!;
                        const yOffset = (index - (asset.metadata.inputs!.length - 1) / 2) * 300;
                        positions.set(inputId, {
                            x: parentPos.x - 350,
                            y: parentPos.y + yOffset,
                            level: level - 1
                        });
                        visited.add(inputId);
                        if (level > -3) { // Limit depth for performance
                            inputQueue.push({ asset: inputAsset, level: level - 1 });
                        }
                    }
                });
            }
        }

        // Position outputs to the right with more spacing
        const outputAssets = lineageAssets.filter(a => a.metadata.inputs?.includes(rootAsset.id));
        const outputQueue: { asset: Asset; level: number }[] = [];

        outputAssets.forEach((outputAsset, index) => {
            if (!visited.has(outputAsset.id)) {
                const yOffset = (index - (outputAssets.length - 1) / 2) * 300;
                positions.set(outputAsset.id, { x: 350, y: yOffset, level: 1 });
                visited.add(outputAsset.id);
                outputQueue.push({ asset: outputAsset, level: 1 });
            }
        });

        // Recursively position output descendants with more spacing
        while (outputQueue.length > 0) {
            const { asset, level } = outputQueue.shift()!;
            const childAssets = lineageAssets.filter(a => a.metadata.inputs?.includes(asset.id));
            childAssets.forEach((childAsset, index) => {
                if (!visited.has(childAsset.id)) {
                    const parentPos = positions.get(asset.id)!;
                    const yOffset = (index - (childAssets.length - 1) / 2) * 300;
                    positions.set(childAsset.id, {
                        x: parentPos.x + 350,
                        y: parentPos.y + yOffset,
                        level: level + 1
                    });
                    visited.add(childAsset.id);
                    if (level < 3) { // Limit depth for performance
                        outputQueue.push({ asset: childAsset, level: level + 1 });
                    }
                }
            });
        }

        return positions;
    }, [rootAsset, lineageAssets]);

    // Create edges (connections between nodes)
    const edges = useMemo(() => {
        const edgeList: { from: string; to: string }[] = [];
        lineageAssets.forEach(asset => {
            if (asset.metadata.inputs) {
                asset.metadata.inputs.forEach(inputId => {
                    if (nodePositions.has(asset.id) && nodePositions.has(inputId)) {
                        edgeList.push({ from: inputId, to: asset.id });
                    }
                });
            }
        });
        return edgeList;
    }, [lineageAssets, nodePositions]);

    return (
        <div className="relative" style={{ width: '4000px', height: '4000px' }}>
            {/* SVG for connections */}
            <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: '100%', height: '100%' }}
                viewBox="-2000 -2000 4000 4000"
            >
                <defs>
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="5"
                        orient="auto"
                    >
                        <polygon
                            points="0 0, 10 5, 0 10"
                            fill="currentColor"
                            className="text-muted-foreground/40"
                        />
                    </marker>
                </defs>
                {edges.map(({ from, to }, index) => {
                    const fromPos = nodePositions.get(from);
                    const toPos = nodePositions.get(to);
                    if (!fromPos || !toPos) return null;

                    // Calculate connection points (from right edge to left edge)
                    // Cards are 256px wide (w-64) and about 296px tall (256px square + 40px bottom)
                    // Connect from middle of right edge to middle of left edge
                    const cardHeight = 296; // Approximate height
                    const startX = fromPos.x + 128; // Right edge of source card
                    const startY = fromPos.y + (cardHeight / 2); // Vertical center of card
                    const endX = toPos.x - 128; // Left edge of target card
                    const endY = toPos.y + (cardHeight / 2); // Vertical center of card

                    // Use a curved path for better visualization
                    const midX = (startX + endX) / 2;
                    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                    return (
                        <path
                            key={index}
                            d={path}
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-muted-foreground/40"
                            markerEnd="url(#arrowhead)"
                            style={{
                                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))',
                                vectorEffect: 'non-scaling-stroke' // Ensures stroke doesn't scale with zoom
                            }}
                        />
                    );
                })}
            </svg>

            {/* Render nodes with full AssetCards */}
            {Array.from(nodePositions.entries()).map(([assetId, position]) => {
                const asset = assetId === rootAsset.id ? rootAsset : lineageAssets.find(a => a.id === assetId);
                if (!asset) return null;

                return (
                    <div
                        key={assetId}
                        className="absolute"
                        style={{
                            left: `${position.x + 2000 - 128}px`, // Center horizontally (256px width / 2)
                            top: `${position.y + 2000}px`, // Position at y directly (no offset needed)
                            zIndex: assetId === rootAsset.id ? 10 : 1
                        }}
                    >
                        <div className={assetId === rootAsset.id ? "ring-4 ring-primary ring-offset-4 rounded-lg" : ""}>
                            <div className="w-64">
                                <AssetCard asset={asset} />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const LineageView: React.FC = () => {
    const lineageAssetId = useStore(state => state.lineageAssetId);
    const setLineageAssetId = useStore(state => state.setLineageAssetId);
    const [lineageAssets, setLineageAssets] = React.useState<Asset[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const transformRef = useRef<any>(null);
    const [optimalScale, setOptimalScale] = React.useState(0.6);

    React.useEffect(() => {
        if (lineageAssetId) {
            setIsLoading(true);
            // @ts-ignore
            window.ipcRenderer.invoke('get-lineage', lineageAssetId)
                .then((assets: Asset[]) => {
                    setLineageAssets(assets);
                    setIsLoading(false);

                    // Calculate optimal scale based on network size
                    const networkSize = assets.length;
                    if (networkSize > 20) {
                        setOptimalScale(0.3);
                    } else if (networkSize > 10) {
                        setOptimalScale(0.4);
                    } else if (networkSize > 5) {
                        setOptimalScale(0.5);
                    } else {
                        setOptimalScale(0.6);
                    }
                })
                .catch((err: any) => {
                    console.error('Failed to fetch lineage:', err);
                    setIsLoading(false);
                });
        } else {
            setLineageAssets([]);
        }
    }, [lineageAssetId]);

    const rootAsset = useMemo(() =>
        lineageAssets.find(a => a.id === lineageAssetId),
        [lineageAssets, lineageAssetId]
    );

    if (!lineageAssetId) return null;

    const handleZoomIn = () => {
        transformRef.current?.zoomIn();
    };

    const handleZoomOut = () => {
        transformRef.current?.zoomOut();
    };

    const handleResetView = () => {
        transformRef.current?.resetTransform();
    };

    const handleFitToScreen = () => {
        transformRef.current?.centerView(0.8);
    };

    return (
        <Dialog open={!!lineageAssetId} onOpenChange={(open) => !open && setLineageAssetId(null)}>
            <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl">
                <DialogHeader className="p-4 border-b">
                    <div className="flex items-center justify-between pr-10">
                        <DialogTitle>Asset Lineage Graph</DialogTitle>

                        {/* Zoom Controls - moved away from close button */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleZoomIn}
                                title="Zoom In"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleZoomOut}
                                title="Zoom Out"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleFitToScreen}
                                title="Fit to Screen"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleResetView}
                                title="Reset View"
                            >
                                <Home className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 w-full h-full relative overflow-hidden bg-grid-pattern">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-muted-foreground">Loading lineage graph...</div>
                        </div>
                    ) : rootAsset ? (
                        <TransformWrapper
                            key={`${lineageAssetId}-${optimalScale}`} // Force remount when scale changes
                            ref={transformRef}
                            initialScale={optimalScale}
                            minScale={0.1}
                            maxScale={2}
                            centerOnInit={false} // We'll handle centering manually
                            limitToBounds={false}
                            initialPositionX={0}
                            initialPositionY={0}
                            panning={{
                                disabled: false,
                                velocityDisabled: false,
                            }}
                            wheel={{
                                step: 0.1,
                                smoothStep: 0.006,
                            }}
                            doubleClick={{
                                disabled: false,
                                mode: "reset"
                            }}
                            onInit={(ref) => {
                                // Center on the selected asset after initialization
                                setTimeout(() => {
                                    ref.centerView(optimalScale, 500); // Add animation duration for smooth centering
                                }, 150);
                            }}
                        >
                            {() => (
                                <>
                                    <TransformComponent
                                        wrapperStyle={{
                                            width: '100%',
                                            height: '100%',
                                        }}
                                        contentStyle={{
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    >
                                        <div className="w-full h-full flex items-center justify-center">
                                            <LineageGraph rootAsset={rootAsset} lineageAssets={lineageAssets} />
                                        </div>
                                    </TransformComponent>

                                    {/* Mini-map / Overview (optional future enhancement) */}
                                    <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm border rounded-lg p-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <span>Scroll to pan</span>
                                            <span className="opacity-50">•</span>
                                            <span>Ctrl+Scroll to zoom</span>
                                            <span className="opacity-50">•</span>
                                            <span>Double-click to reset</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </TransformWrapper>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-muted-foreground">Asset not found</div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
