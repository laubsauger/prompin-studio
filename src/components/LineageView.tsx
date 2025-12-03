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

const LineageGraph: React.FC<{ rootAsset: Asset, lineageAssets: Asset[], onLayoutComplete?: (rootPos: { x: number, y: number }) => void }> = ({ rootAsset, lineageAssets, onLayoutComplete }) => {
    const aspectRatio = useStore(state => state.aspectRatio);
    const DEBUG = true; // Toggle debug visualization

    // Calculate node positions using dagre
    const { nodePositions, edges, graphWidth, graphHeight, nodeWidth, nodeHeight } = useMemo(() => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: 'LR',
            ranker: 'longest-path', // Better for timeline/lineage alignment
            nodesep: 100, // Vertical spacing between nodes
            ranksep: 200, // Horizontal spacing - reduced to bring nodes closer
            marginx: 100,
            marginy: 100
        });
        g.setDefaultEdgeLabel(() => ({}));

        // Card size: w-64 (256px)
        // const cardWidth = 256; // Unused

        // Calculate height based on aspect ratio + padding for metadata/badges
        // Square: 256px image + ~80px metadata
        // Video: 144px image + ~80px metadata
        // Portrait: ~455px image + ~80px metadata
        let imageHeight = 256;
        if (aspectRatio === 'video') imageHeight = 144;
        if (aspectRatio === 'portrait') imageHeight = 455; // 9/16 of 256

        const nodeWidth = 256; // Exact match to card width
        const nodeHeight = imageHeight + 50; // Reduced buffer to match card footer height
        // const imageCenterY = imageHeight / 2; // Unused

        lineageAssets.forEach(asset => {
            g.setNode(asset.id, { width: nodeWidth, height: nodeHeight });
        });

        // Add edges
        // const edgeList: { from: string; to: string }[] = []; // Removed manual edge list tracking
        lineageAssets.forEach(asset => {
            if (asset.metadata.inputs) {
                asset.metadata.inputs.forEach(inputId => {
                    // Only add edge if the input asset is actually in our lineage list
                    // This prevents "ghost" nodes/lines that push everything to the right
                    if (lineageAssets.some(a => a.id === inputId)) {
                        g.setEdge(inputId, asset.id);
                        // edgeList.push({ from: inputId, to: asset.id });
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

        // Extract edge points
        const edgeList: { points: { x: number; y: number }[] }[] = [];
        g.edges().forEach(e => {
            const edge = g.edge(e);
            edgeList.push({ points: edge.points });
        });

        const graphWidth = g.graph().width || 1000;
        const graphHeight = g.graph().height || 1000;

        return { nodePositions: positions, edges: edgeList, graphWidth, graphHeight, nodeWidth, nodeHeight };
    }, [rootAsset, lineageAssets, aspectRatio]);

    // Notify parent of root position for centering
    React.useEffect(() => {
        if (onLayoutComplete) {
            const rootPos = nodePositions.get(rootAsset.id);
            if (rootPos) {
                onLayoutComplete(rootPos);
            }
        }
    }, [nodePositions, rootAsset.id, onLayoutComplete]);

    // Padding for the container
    const padding = 100; // Reduced from 1000 to simplify debugging
    const containerWidth = graphWidth + padding * 2;
    const containerHeight = graphHeight + padding * 2;
    const cardWidth = 256; // This cardWidth is used below, so it's not unused.
    // const nodeWidth = 350; // Now coming from useMemo
    const cardOffset = (nodeWidth - cardWidth) / 2;

    return (
        <div className="relative" style={{ width: `${containerWidth}px`, height: `${containerHeight}px` }}>
            {/* Debug Grid */}
            {DEBUG && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
                        backgroundSize: '100px 100px',
                        opacity: 0.2
                    }}
                />
            )}

            {/* Debug Panel */}
            {DEBUG && (
                <div className="fixed top-20 right-4 bg-black/80 text-white p-4 rounded z-50 text-xs font-mono border border-white/20">
                    <div>Graph: {graphWidth}x{graphHeight}</div>
                    <div>Container: {containerWidth}x{containerHeight}</div>
                    <div>Node: {nodeWidth}x{nodeHeight}</div>
                    <div>Padding: {padding}</div>
                    <div>Nodes: {nodePositions.size}</div>
                    <div>Edges: {edges.length}</div>
                </div>
            )}

            {/* Origin Marker (0,0 of graph content) */}
            {DEBUG && (
                <div
                    className="absolute w-4 h-4 bg-green-500 rounded-full z-50"
                    style={{ left: padding - 8, top: padding - 8 }}
                    title="Graph Origin (0,0)"
                />
            )}
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
                {edges.map(({ points }, index) => {
                    if (!points || points.length === 0) return null;

                    // Construct path from points
                    // Apply padding to coordinates
                    // Simple smoothing: use the points as control points for a curve?
                    // Or just stick to L for now but ensure they are correct.
                    // Let's try to make a simple Catmull-Rom-like path or just straight lines.
                    // Dagre gives us points that are meant to be connected linearly or with B-splines.
                    // Let's try a simple cubic bezier if we have enough points, otherwise linear.

                    let d = '';
                    if (points.length === 0) return null;

                    const p0 = points[0];
                    d += `M ${p0.x + padding} ${p0.y + padding}`;

                    // If we have intermediate points, use them
                    for (let i = 1; i < points.length; i++) {
                        const p = points[i];
                        d += ` L ${p.x + padding} ${p.y + padding}`;
                    }

                    // TODO: Implement proper curve smoothing later if needed.
                    // For now, straight lines between dagre points is the most accurate representation of the layout.

                    return (
                        <path
                            key={index}
                            d={d}
                            stroke="currentColor"
                            strokeWidth="4"
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
                        {/* Debug overlay to visualize dagre's bounding box vs actual content */}
                        {DEBUG && (
                            <>
                                {/* Red Box: The space dagre thinks the node occupies */}
                                <div
                                    className="absolute border-2 border-red-500 pointer-events-none"
                                    style={{
                                        width: nodeWidth,
                                        height: nodeHeight,
                                        left: -cardOffset, // Shift back to align with dagre's top-left
                                        top: 0
                                    }}
                                >
                                    {/* Crosshair at center of dagre node */}
                                    <div className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-red-500 -translate-x-1/2" />
                                    <div className="absolute top-1/2 left-1/2 h-4 w-0.5 bg-red-500 -translate-y-1/2" />
                                    <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-1">
                                        {Math.round(position.x)},{Math.round(position.y)}
                                    </div>
                                </div>
                                {/* Blue Box: The actual card space */}
                                <div
                                    className="absolute inset-0 border-2 border-blue-500 pointer-events-none"
                                />
                            </>
                        )}

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
                            onInit={() => {
                                // Wait for layout to complete and root position to be available
                                // We'll handle centering in a separate effect or callback, 
                                // but we can try to center if we already have it (unlikely on first render)
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
                                        <LineageGraph
                                            rootAsset={rootAsset}
                                            lineageAssets={displayedAssets}
                                            onLayoutComplete={(pos) => {
                                                // Center on the root node
                                                // Center on the root node
                                                // We need to account for padding (100) and card offset
                                                const padding = 100;
                                                const cardWidth = 256;
                                                const nodeWidth = 256; // Should match useMemo
                                                const cardOffset = (nodeWidth - cardWidth) / 2;

                                                const x = pos.x + padding + cardOffset + (cardWidth / 2);
                                                const y = pos.y + padding + (256 / 2); // Approximate center Y

                                                // Use zoomToElement-like logic or setTransform directly if exposed
                                                // Since we don't have direct element ref here easily, we can calculate offsets

                                                if (transformRef.current) {
                                                    // centerView centers the whole content. We want to center a specific point.
                                                    // We can use setTransform.
                                                    // Viewport Center:
                                                    // targetX = (viewportWidth / 2) - (nodeX * scale)
                                                    // targetY = (viewportHeight / 2) - (nodeY * scale)

                                                    // Let's just use a slight delay to ensure DOM is ready
                                                    setTimeout(() => {
                                                        const instance = transformRef.current.instance;
                                                        const wrapper = instance.wrapperComponent;
                                                        if (wrapper) {
                                                            const wrapperRect = wrapper.getBoundingClientRect();
                                                            const targetX = (wrapperRect.width / 2) - (x * optimalScale);
                                                            const targetY = (wrapperRect.height / 2) - (y * optimalScale);

                                                            transformRef.current.setTransform(targetX, targetY, optimalScale, 500);
                                                        }
                                                    }, 100);
                                                }
                                            }}
                                        />
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
