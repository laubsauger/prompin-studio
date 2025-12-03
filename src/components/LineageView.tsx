import React, { useMemo, useRef } from 'react';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AssetCard } from './AssetCard';
import type { Asset } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Home } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Button } from './ui/button';
import dagre from 'dagre';
import { cn } from '../lib/utils';

const LineageGraph: React.FC<{ rootAsset: Asset, lineageAssets: Asset[] }> = ({ rootAsset, lineageAssets }) => {
    // Calculate node positions using dagre
    const { nodePositions, edges, graphWidth, graphHeight } = useMemo(() => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: 'LR',
            ranker: 'longest-path', // Better for lineage/hierarchical flows
            nodesep: 50, // Vertical spacing between nodes
            ranksep: 100, // Reduced rank separation for tighter layout
            marginx: 50,
            marginy: 50
        });
        g.setDefaultEdgeLabel(() => ({}));

        // Card size: w-64 (256px)
        // We allocate slightly more space for the node in the graph
        const nodeWidth = 300;
        const nodeHeight = 400;

        lineageAssets.forEach(asset => {
            g.setNode(asset.id, { width: nodeWidth, height: nodeHeight });
        });

        // Add edges
        const edgeList: { from: string; to: string }[] = [];
        lineageAssets.forEach(asset => {
            if (asset.metadata.inputs) {
                asset.metadata.inputs.forEach(inputId => {
                    if (lineageAssets.some(a => a.id === inputId)) {
                        g.setEdge(inputId, asset.id);
                        edgeList.push({ from: inputId, to: asset.id });
                    }
                });
            }
        });

        dagre.layout(g);

        const positions = new Map<string, { x: number; y: number }>();
        g.nodes().forEach(v => {
            const node = g.node(v);
            // dagre returns center coordinates, we need top-left for absolute positioning
            positions.set(v, {
                x: node.x - nodeWidth / 2,
                y: node.y - nodeHeight / 2
            });
        });

        const graphWidth = g.graph().width || 1000;
        const graphHeight = g.graph().height || 1000;

        return { nodePositions: positions, edges: edgeList, graphWidth, graphHeight };
    }, [rootAsset, lineageAssets]);

    // Padding for the container
    const padding = 1000;
    const containerWidth = graphWidth + padding * 2;
    const containerHeight = graphHeight + padding * 2;
    const cardWidth = 256;
    const nodeWidth = 300;
    const cardOffset = (nodeWidth - cardWidth) / 2;

    return (
        <div className="relative" style={{ width: `${containerWidth}px`, height: `${containerHeight}px` }}>
            {/* SVG for connections */}
            <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: '100%', height: '100%', zIndex: 0 }}
                viewBox={`0 0 ${containerWidth} ${containerHeight}`}
            >
                <defs>
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                    >
                        <polygon
                            points="0 0, 10 3.5, 0 7"
                            fill="currentColor"
                            className="text-muted-foreground/60"
                        />
                    </marker>
                </defs>
                {edges.map(({ from, to }, index) => {
                    const fromPos = nodePositions.get(from);
                    const toPos = nodePositions.get(to);
                    if (!fromPos || !toPos) return null;

                    // Calculate connection points
                    // We align to the center of the image (assuming 256x256 image)
                    const imageCenterY = 128;

                    // Start: Right edge of source card
                    const startX = fromPos.x + padding + cardOffset + cardWidth;
                    const startY = fromPos.y + padding + imageCenterY;

                    // End: Left edge of target card
                    const endX = toPos.x + padding + cardOffset;
                    const endY = toPos.y + padding + imageCenterY;

                    // Use a curved path (Bezier)
                    const midX = (startX + endX) / 2;
                    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                    return (
                        <path
                            key={index}
                            d={path}
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            className="text-muted-foreground/60"
                            markerEnd="url(#arrowhead)"
                            style={{
                                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
                            }}
                        />
                    );
                })}
            </svg>

            {/* Render nodes */}
            {Array.from(nodePositions.entries()).map(([assetId, position]) => {
                const asset = assetId === rootAsset.id ? rootAsset : lineageAssets.find(a => a.id === assetId);
                if (!asset) return null;

                return (
                    <div
                        key={assetId}
                        className="absolute"
                        style={{
                            left: `${position.x + padding + cardOffset}px`,
                            top: `${position.y + padding}px`,
                            width: `${cardWidth}px`,
                            zIndex: 10
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
    const [isScoped, setIsScoped] = React.useState(true);

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

    const displayedAssets = useMemo(() => {
        if (!isScoped || !rootAsset) return lineageAssets;

        const scopedIds = new Set<string>();
        scopedIds.add(rootAsset.id);

        // Traverse Up (Ancestors)
        const queueUp = [rootAsset.id];
        while (queueUp.length > 0) {
            const currentId = queueUp.shift()!;
            const asset = lineageAssets.find(a => a.id === currentId);
            if (asset && asset.metadata.inputs) {
                for (const inputId of asset.metadata.inputs) {
                    if (!scopedIds.has(inputId)) {
                        scopedIds.add(inputId);
                        queueUp.push(inputId);
                    }
                }
            }
        }

        // Traverse Down (Descendants)
        const queueDown = [rootAsset.id];
        while (queueDown.length > 0) {
            const currentId = queueDown.shift()!;
            // Find assets that have currentId as input
            const children = lineageAssets.filter(a => a.metadata.inputs?.includes(currentId));
            for (const child of children) {
                if (!scopedIds.has(child.id)) {
                    scopedIds.add(child.id);
                    queueDown.push(child.id);
                }
            }
        }

        return lineageAssets.filter(a => scopedIds.has(a.id));
    }, [lineageAssets, rootAsset, isScoped]);

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
                        <div className="flex items-center gap-4">
                            <DialogTitle>Asset Lineage Graph</DialogTitle>
                            <div className="flex items-center bg-muted rounded-lg p-1">
                                <button
                                    onClick={() => setIsScoped(true)}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        isScoped ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Scoped
                                </button>
                                <button
                                    onClick={() => setIsScoped(false)}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        !isScoped ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Full Graph
                                </button>
                            </div>
                        </div>

                        {/* Zoom Controls */}
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
                            key={`${lineageAssetId}-${optimalScale}-${isScoped}`}
                            ref={transformRef}
                            initialScale={optimalScale}
                            minScale={0.1}
                            maxScale={2}
                            centerOnInit={false}
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
                                setTimeout(() => {
                                    ref.centerView(optimalScale, 500);
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
                                        <LineageGraph rootAsset={rootAsset} lineageAssets={displayedAssets} />
                                    </TransformComponent>

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
