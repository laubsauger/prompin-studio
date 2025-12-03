import React, { useEffect, useState, useMemo } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Heart, Tag, FolderOpen, Info, ChevronDown, ChevronUp, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { CreateTagDialog } from './CreateTagDialog';
import { MetadataEditor } from './MetadataEditor';
import { StatusSelector } from './StatusSelector';
import type { AssetStatus } from '../types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export const MediaViewer: React.FC = () => {
    const { viewingAssetId, setViewingAssetId, assets, toggleLike, tags, addTagToAsset, removeTagFromAsset, createTag, updateAssetStatus } = useStore();
    const [showMetadata, setShowMetadata] = useState(false);
    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);
    const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);

    const asset = assets.find(a => a.id === viewingAssetId);

    // Get current asset index and navigation info
    const { currentIndex, hasNext, hasPrevious } = useMemo(() => {
        const index = assets.findIndex(a => a.id === viewingAssetId);
        return {
            currentIndex: index,
            hasNext: index < assets.length - 1,
            hasPrevious: index > 0
        };
    }, [assets, viewingAssetId]);

    // Navigation functions
    const navigateToNext = () => {
        if (hasNext && currentIndex !== -1) {
            setViewingAssetId(assets[currentIndex + 1].id);
        }
    };

    const navigateToPrevious = () => {
        if (hasPrevious && currentIndex !== -1) {
            setViewingAssetId(assets[currentIndex - 1].id);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent navigation if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key) {
                case 'Escape':
                    setViewingAssetId(null);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    navigateToPrevious();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    navigateToNext();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setViewingAssetId, currentIndex, hasNext, hasPrevious]);

    if (!asset) return null;

    const fileName = asset.path.split('/').pop() || asset.path;
    const folderPath = asset.path.substring(0, asset.path.lastIndexOf('/')) || '/';

    const handleRevealInFinder = async () => {
        const ipc = (window as any).ipcRenderer;
        if (ipc) {
            await ipc.invoke('reveal-in-finder', asset.path);
        }
    };

    const handleCreateTag = async (name: string, color: string) => {
        await createTag(name, color);
        setIsCreateTagDialogOpen(false);
    };

    return (
        <>
            <div className="fixed inset-x-0 bottom-0 top-10 z-[50] flex flex-col bg-background/98 backdrop-blur-sm animate-in fade-in duration-200">
                {/* Header Bar */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-sm">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-sm truncate" title={fileName}>{fileName}</span>
                            <span className="font-mono text-xs text-muted-foreground truncate" title={folderPath}>
                                {folderPath}
                            </span>
                        </div>

                        {/* Action Buttons - Icon Only */}
                        <div className="flex items-center gap-1">
                            <StatusSelector
                                currentStatus={asset.status}
                                onStatusChange={(status: AssetStatus) => updateAssetStatus(asset.id, status)}
                                compact
                                overlayStyle
                            />

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleLike(asset.id)}
                                className={cn("h-8 w-8", asset.metadata.liked && "text-red-500")}
                                title={asset.metadata.liked ? "Unlike" : "Like"}
                            >
                                <Heart className={cn("h-4 w-4", asset.metadata.liked && "fill-current")} />
                            </Button>

                            {/* Tags Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Manage Tags">
                                        <Tag className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48">
                                    <DropdownMenuItem onSelect={() => setIsCreateTagDialogOpen(true)}>
                                        Create New Tag...
                                    </DropdownMenuItem>
                                    {tags.length > 0 && (
                                        <>
                                            <DropdownMenuSeparator />
                                            {tags.map(tag => {
                                                const isApplied = asset.tags?.some(t => t.id === tag.id);
                                                return (
                                                    <DropdownMenuItem
                                                        key={tag.id}
                                                        onSelect={() => {
                                                            if (isApplied) {
                                                                removeTagFromAsset(asset.id, tag.id);
                                                            } else {
                                                                addTagToAsset(asset.id, tag.id);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 w-full">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: tag.color }}
                                                            />
                                                            <span className="flex-1">{tag.name}</span>
                                                            {isApplied && <span className="text-xs">✓</span>}
                                                        </div>
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleRevealInFinder}
                                title="Reveal in Finder"
                            >
                                <FolderOpen className="h-4 w-4" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", showMetadata && "bg-accent")}
                                onClick={() => setShowMetadata(!showMetadata)}
                                title={showMetadata ? "Hide Info" : "Show Info"}
                            >
                                <Info className="h-4 w-4" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setIsMetadataEditorOpen(true)}
                                title="Edit Metadata"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex items-center gap-1 border-l pl-2 ml-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={navigateToPrevious}
                                disabled={!hasPrevious}
                                title="Previous (←)"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground px-1">
                                {currentIndex + 1} / {assets.length}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={navigateToNext}
                                disabled={!hasNext}
                                title="Next (→)"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <Button variant="ghost" size="icon" onClick={() => setViewingAssetId(null)}>
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </div>
                </div>

                {/* Metadata Panel */}
                {showMetadata && (
                    <div className="p-4 border-b border-border bg-background/80 backdrop-blur-sm space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Type:</span>
                                <span className="ml-2">{asset.type}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Author:</span>
                                <span className="ml-2">{asset.metadata.authorId || 'Unknown'}</span>
                            </div>
                            {asset.metadata.prompt && (
                                <div className="col-span-2">
                                    <span className="text-muted-foreground">Prompt:</span>
                                    <span className="ml-2">{asset.metadata.prompt}</span>
                                </div>
                            )}
                        </div>
                        {asset.tags && asset.tags.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Tags:</span>
                                <div className="flex flex-wrap gap-2">
                                    {asset.tags.map(tag => (
                                        <div key={tag.id} className="flex items-center px-2 py-1 rounded-md bg-accent/50 text-xs gap-1">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                            {tag.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Media Display */}
                <div className="flex-1 overflow-hidden flex items-center justify-center bg-black/5">
                    {asset.type === 'image' ? (
                        <div className="w-full h-full relative">
                            <TransformWrapper
                                minScale={0.1}
                                maxScale={10}
                                initialScale={1}
                                centerOnInit={true}
                                limitToBounds={false}
                                panning={{
                                    disabled: false,
                                    velocityDisabled: false,
                                }}
                                wheel={{
                                    step: 0.1,
                                }}
                                doubleClick={{
                                    mode: 'reset'
                                }}
                            >
                                {(utils) => (
                                    <TransformComponent
                                        wrapperStyle={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <img
                                            src={`media://${asset.path}`}
                                            alt={asset.path}
                                            style={{
                                                display: 'block',
                                                cursor: 'grab',
                                                maxWidth: 'none',
                                                maxHeight: 'none',
                                            }}
                                            draggable={false}
                                            onLoad={(e) => {
                                                const img = e.currentTarget;
                                                const wrapper = document.querySelector('.react-transform-component') as HTMLElement;

                                                if (wrapper && img.naturalWidth && img.naturalHeight) {
                                                    const wrapperRect = wrapper.getBoundingClientRect();
                                                    const scaleX = wrapperRect.width / img.naturalWidth;
                                                    const scaleY = wrapperRect.height / img.naturalHeight;
                                                    const scale = Math.min(scaleX, scaleY, 1) * 0.9; // 90% to leave some padding

                                                    // Reset first to ensure clean state
                                                    utils.resetTransform();

                                                    // Then center with calculated scale
                                                    // We need a slight delay for the reset to apply? 
                                                    // Actually centerView handles it.
                                                    setTimeout(() => {
                                                        utils.centerView(scale, 0);
                                                    }, 50);
                                                }
                                            }}
                                        />
                                    </TransformComponent>
                                )}
                            </TransformWrapper>
                        </div>
                    ) : (
                        <MediaPlayer
                            src={`media://${asset.path}`}
                            viewType="video"
                            streamType="on-demand"
                            logLevel="warn"
                            crossOrigin
                            playsInline
                            title={asset.path}
                            className="w-full h-full"
                            autoPlay
                        >
                            <MediaProvider />
                            <DefaultVideoLayout icons={defaultLayoutIcons} />
                        </MediaPlayer>
                    )}
                </div>
            </div>

            <CreateTagDialog
                isOpen={isCreateTagDialogOpen}
                onClose={() => setIsCreateTagDialogOpen(false)}
                onCreateTag={(name, color) => handleCreateTag(name, color || '#000000')}
            />

            <MetadataEditor
                isOpen={isMetadataEditorOpen}
                onClose={() => setIsMetadataEditorOpen(false)}
                asset={asset}
            />
        </>
    );
};
