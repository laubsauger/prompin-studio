import React, { useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Heart, Tag, FolderOpen, Info, ChevronDown, ChevronUp, Edit } from 'lucide-react';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { CreateTagDialog } from './CreateTagDialog';
import { MetadataEditor } from './MetadataEditor';
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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setViewingAssetId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setViewingAssetId]);

    if (!asset) return null;

    const statusConfig = ASSET_STATUSES[asset.status] || ASSET_STATUSES.unsorted;
    const fileName = asset.path.split('/').pop() || asset.path;
    const folderPath = asset.path.substring(0, asset.path.lastIndexOf('/')) || '/';

    const handleRevealInFinder = async () => {
        const ipc = (window as any).ipcRenderer;
        if (ipc) {
            await ipc.invoke('reveal-in-finder', asset.path);
        }
    };

    const handleCreateTag = (name: string, color: string) => {
        createTag(name, color);
        setIsCreateTagDialogOpen(false);
    };

    return (
        <>
            <div className="fixed inset-x-0 bottom-0 top-10 z-[50] flex flex-col bg-background/98 backdrop-blur-sm animate-in fade-in duration-200">
                {/* Header Bar */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-sm">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate" title={fileName}>{fileName}</span>
                                <Badge
                                    variant="secondary"
                                    className={cn("text-[10px] h-5 px-1.5", statusConfig.color, "text-white border-none")}
                                >
                                    {statusConfig.label}
                                </Badge>
                                {asset.metadata.liked && (
                                    <Heart className="h-4 w-4 text-red-500 fill-current" />
                                )}
                            </div>
                            <span className="font-mono text-xs text-muted-foreground truncate" title={folderPath}>
                                {folderPath}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleLike(asset.id)}
                                className={cn(asset.metadata.liked && "text-red-500")}
                            >
                                <Heart className={cn("h-4 w-4 mr-1", asset.metadata.liked && "fill-current")} />
                                {asset.metadata.liked ? 'Liked' : 'Like'}
                            </Button>

                            {/* Status Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <Edit className="h-4 w-4 mr-1" />
                                        Status
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {Object.entries(ASSET_STATUSES).map(([key, config]) => (
                                        <DropdownMenuItem
                                            key={key}
                                            onClick={() => updateAssetStatus(asset.id, key as any)}
                                            className={asset.status === key ? 'bg-accent' : ''}
                                        >
                                            <div className={cn("w-2 h-2 rounded-full mr-2", config.color)} />
                                            {config.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Tags Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <Tag className="h-4 w-4 mr-1" />
                                        Tags
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
                                                                addTagToAsset(asset.id, tag);
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
                                size="sm"
                                onClick={handleRevealInFinder}
                            >
                                <FolderOpen className="h-4 w-4 mr-1" />
                                Reveal
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowMetadata(!showMetadata)}
                            >
                                <Info className="h-4 w-4 mr-1" />
                                Info
                                {showMetadata ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsMetadataEditorOpen(true)}
                            >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
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
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <TransformWrapper
                                minScale={0.5}
                                maxScale={5}
                                initialScale={1}
                                centerOnInit={true}
                            >
                                <TransformComponent
                                    wrapperStyle={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    contentStyle={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <img
                                        src={`media://${asset.path}`}
                                        alt={asset.path}
                                        className="max-w-full max-h-full object-contain"
                                        style={{
                                            maxHeight: '100%',
                                            maxWidth: '100%',
                                            width: 'auto',
                                            height: 'auto'
                                        }}
                                    />
                                </TransformComponent>
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
                onCreateTag={handleCreateTag}
            />

            <MetadataEditor
                isOpen={isMetadataEditorOpen}
                onClose={() => setIsMetadataEditorOpen(false)}
                asset={asset}
            />
        </>
    );
};
