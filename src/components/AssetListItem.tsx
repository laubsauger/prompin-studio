import React from 'react';
import type { Asset } from '../types';
import { Badge } from './ui/badge';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { Film, Image as ImageIcon, Heart, FolderOpen } from 'lucide-react';
import { useStore } from '../store';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "./ui/context-menu";
import { CreateTagDialog } from './CreateTagDialog';

interface AssetListItemProps {
    asset: Asset;
    setViewingAssetId: (id: string | null) => void;
}

const AssetListItemComponent: React.FC<AssetListItemProps> = ({ asset, setViewingAssetId }) => {
    const { toggleLike, tags, addTagToAsset, removeTagFromAsset, createTag } = useStore();
    const isSelected = useStore(state => state.selectedIds.has(asset.id));
    const toggleSelection = useStore(state => state.toggleSelection);
    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = React.useState(false);

    const statusConfig = ASSET_STATUSES[asset.status] || ASSET_STATUSES.unsorted;

    const thumbnailSrc = asset.type === 'video' && asset.thumbnailPath
        ? `thumbnail://${asset.thumbnailPath}`
        : `media://${asset.path}`;

    const handleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;

        if (e.shiftKey) {
            toggleSelection(asset.id, e.metaKey || e.ctrlKey);
        } else {
            setViewingAssetId(asset.id);
        }
    };

    // Format duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return null;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format file size
    const formatSize = (bytes?: number) => {
        if (!bytes) return null;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    // Format resolution
    const resolution = asset.metadata.width && asset.metadata.height
        ? `${asset.metadata.width}×${asset.metadata.height}`
        : null;

    const fileSize = formatSize(asset.metadata.fileSize);

    // Format date
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    onClick={handleClick}
                    className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer",
                        isSelected && "bg-accent border-primary"
                    )}
                >
                    {/* Thumbnail */}
                    <div className="relative w-32 h-20 flex-shrink-0 bg-muted rounded overflow-hidden">
                        <img
                            src={thumbnailSrc}
                            alt={asset.path}
                            className="w-full h-full object-cover"
                        />
                        {asset.type === 'video' && (
                            <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1 py-0.5">
                                <span className="text-[10px] text-white font-mono">
                                    {formatDuration(asset.metadata.duration) || <Film className="h-3 w-3" />}
                                </span>
                            </div>
                        )}
                        {asset.metadata.liked && (
                            <div className="absolute top-1 right-1">
                                <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 drop-shadow-lg" />
                            </div>
                        )}
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            {asset.type === 'video' ? (
                                <Film className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                                <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">{asset.path.split('/').pop()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate" title={asset.path}>
                            {asset.path}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <Badge variant="outline" className={cn("text-[10px] h-5", statusConfig.color, "text-white border-none")}>
                                {statusConfig.label}
                            </Badge>
                            {asset.tags?.slice(0, 3).map(tag => (
                                <Badge key={tag.id} variant="outline" className="text-[10px] h-5" style={{ borderColor: tag.color, color: tag.color }}>
                                    {tag.name}
                                </Badge>
                            ))}
                            {asset.tags && asset.tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{asset.tags.length - 3}</span>
                            )}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground min-w-[220px]">
                        {resolution && (
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium w-20">Resolution:</span>
                                <span className="font-mono">{resolution}</span>
                            </div>
                        )}
                        {asset.type === 'video' && asset.metadata.duration && (
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium w-20">Duration:</span>
                                <span className="font-mono">{formatDuration(asset.metadata.duration)}</span>
                            </div>
                        )}
                        {fileSize && (
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium w-20">Size:</span>
                                <span className="font-mono">{fileSize}</span>
                            </div>
                        )}
                        {asset.metadata.model && (
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium w-20">Model:</span>
                                <span className="truncate">{asset.metadata.model}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <span className="font-medium w-20">Modified:</span>
                            <span className="text-[11px]">{formatDate(asset.updatedAt)}</span>
                        </div>
                    </div>

                    {/* Author/Project Info (if available) */}
                    {(asset.metadata.authorId || asset.metadata.project) && (
                        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground min-w-[150px] border-l border-border pl-3">
                            {asset.metadata.authorId && (
                                <div className="flex items-center gap-1.5">
                                    <span className="font-medium">Author:</span>
                                    <span className="truncate">{asset.metadata.authorId}</span>
                                </div>
                            )}
                            {asset.metadata.project && (
                                <div className="flex items-center gap-1.5">
                                    <span className="font-medium">Project:</span>
                                    <span className="truncate">{asset.metadata.project}</span>
                                </div>
                            )}
                            {asset.metadata.scene && (
                                <div className="flex items-center gap-1.5">
                                    <span className="font-medium">Scene:</span>
                                    <span className="truncate">{asset.metadata.scene}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem onClick={async () => {
                    const ipc = (window as any).ipcRenderer;
                    if (ipc) {
                        await ipc.invoke('reveal-in-finder', asset.path);
                    }
                }}>
                    <FolderOpen className="mr-2 h-4 w-4" /> Show in Finder
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => toggleLike(asset.id)}>
                    {asset.metadata.liked ? 'Unlike' : 'Like'}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuSub>
                    <ContextMenuSubTrigger>Tags</ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                        <ContextMenuItem onSelect={(e: Event) => {
                            e.preventDefault();
                            setIsCreateTagDialogOpen(true);
                        }}>
                            Create New Tag...
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        {tags.map(tag => {
                            const hasTag = asset.tags?.some(t => t.id === tag.id);
                            return (
                                <ContextMenuItem
                                    key={tag.id}
                                    onClick={() => {
                                        if (hasTag) {
                                            removeTagFromAsset(asset.id, tag.id);
                                        } else {
                                            addTagToAsset(asset.id, tag.id);
                                        }
                                    }}
                                >
                                    {hasTag ? '✓ ' : ''}{tag.name}
                                </ContextMenuItem>
                            );
                        })}
                    </ContextMenuSubContent>
                </ContextMenuSub>
            </ContextMenuContent>

            <CreateTagDialog
                isOpen={isCreateTagDialogOpen}
                onClose={() => setIsCreateTagDialogOpen(false)}
                onCreateTag={createTag}
            />
        </ContextMenu>
    );
};

// Memoize to prevent unnecessary re-renders
const arePropsEqual = (prevProps: Readonly<AssetListItemProps>, nextProps: Readonly<AssetListItemProps>): boolean => {
    const prev = prevProps.asset;
    const next = nextProps.asset;

    if (prev.id !== next.id) return false;

    // Check if any relevant properties changed
    return (
        prev.status === next.status &&
        prev.thumbnailPath === next.thumbnailPath &&
        prev.metadata.liked === next.metadata.liked &&
        prev.metadata.fileSize === next.metadata.fileSize &&
        prev.metadata.width === next.metadata.width &&
        prev.metadata.height === next.metadata.height &&
        prev.metadata.duration === next.metadata.duration &&
        prev.updatedAt === next.updatedAt &&
        prev.tags?.length === next.tags?.length &&
        prev.tags?.every((t, i) => t.id === next.tags?.[i]?.id)
    );
};

export const AssetListItem = React.memo(AssetListItemComponent, arePropsEqual);
