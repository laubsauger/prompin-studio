import React, { useState } from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { FolderOpen, Heart, Plus, Tag, FileText, GitFork, StickyNote } from 'lucide-react';
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

interface AssetContextMenuProps {
    asset: Asset;
    children: React.ReactNode;
}

import { CreateScratchPadDialog } from './CreateScratchPadDialog';
import { MetadataEditor } from './MetadataEditor';

export const AssetContextMenu: React.FC<AssetContextMenuProps> = ({ asset, children }) => {
    const toggleLike = useStore(state => state.toggleLike);
    const tags = useStore(state => state.tags);
    const addTagToAsset = useStore(state => state.addTagToAsset);
    const removeTagFromAsset = useStore(state => state.removeTagFromAsset);
    const createTag = useStore(state => state.createTag);
    const createScratchPad = useStore(state => state.createScratchPad);
    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);
    const [isCreateScratchPadDialogOpen, setIsCreateScratchPadDialogOpen] = useState(false);
    const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);

    const statusConfig = ASSET_STATUSES[asset.status] || ASSET_STATUSES.unsorted;

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    {children}
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(asset.id);
                    }}>
                        <Heart className={cn("mr-2 h-4 w-4", asset.metadata.liked && "fill-current text-red-500")} />
                        {asset.metadata.liked ? 'Unlike' : 'Like'}
                    </ContextMenuItem>

                    <ContextMenuSub>
                        <ContextMenuSubTrigger>
                            <div className="flex items-center">
                                <div className={cn("w-2 h-2 rounded-full mr-2", statusConfig.color)} />
                                Status
                            </div>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                            {Object.entries(ASSET_STATUSES).map(([key, config]) => (
                                <ContextMenuItem
                                    key={key}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        useStore.getState().updateAssetStatus(asset.id, key as any);
                                    }}
                                >
                                    <div className={cn("w-2 h-2 rounded-full mr-2", config.color)} />
                                    {config.label}
                                    {asset.status === key && <span className="ml-auto text-xs">✓</span>}
                                </ContextMenuItem>
                            ))}
                        </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuSub>
                        <ContextMenuSubTrigger>
                            <Tag className="mr-2 h-4 w-4" />
                            Tags
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                            <ContextMenuItem onSelect={(e) => {
                                e.preventDefault();
                                setIsCreateTagDialogOpen(true);
                            }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Create New Tag...
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            {tags.length === 0 ? (
                                <ContextMenuItem disabled className="text-muted-foreground italic">
                                    No Tags
                                </ContextMenuItem>
                            ) : (
                                tags.map(tag => {
                                    const hasTag = asset.tags?.some(t => t.id === tag.id);
                                    return (
                                        <ContextMenuItem
                                            key={tag.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (hasTag) {
                                                    removeTagFromAsset(asset.id, tag.id);
                                                } else {
                                                    addTagToAsset(asset.id, tag.id);
                                                }
                                            }}
                                        >
                                            <Tag className="w-4 h-4 mr-2" style={{ color: tag.color }} />
                                            {tag.name}
                                            {hasTag && <span className="ml-auto text-xs">✓</span>}
                                        </ContextMenuItem>
                                    );
                                })
                            )}
                        </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setIsMetadataEditorOpen(true);
                    }}>
                        <FileText className="mr-2 h-4 w-4" /> Edit Metadata...
                    </ContextMenuItem>

                    <ContextMenuItem onClick={async (e) => {
                        e.stopPropagation();
                        const ipc = (window as any).ipcRenderer;
                        if (ipc) {
                            await ipc.invoke('reveal-in-finder', asset.path);
                        }
                    }}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Show in Finder
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    <ContextMenuItem onClick={(e) => {
                        e.stopPropagation();
                        useStore.getState().setLineageAssetId(asset.id);
                    }}>
                        <GitFork className="mr-2 h-4 w-4" /> View Lineage
                    </ContextMenuItem>
                    <ContextMenuItem onClick={(e) => {
                        e.stopPropagation();

                        const name = `Derived from ${asset.path.split('/').pop()}`;

                        // Create Active View
                        useStore.getState().addActiveView(name, {
                            relatedToAssetId: asset.id,
                            type: 'all',
                            status: 'all',
                            likedOnly: false,
                            tagId: undefined,
                            scratchPadId: undefined
                        });

                        // We don't automatically switch to it, or maybe we should?
                        // User said "hop around between normal view and those"
                        // Let's just create it and maybe notify or switch?
                        // The user said "creates a temporary item under library... navigate away"
                        // So let's just create it. The user can click it in the sidebar.
                        // Actually, let's switch to it for convenience, but it's now a persistent view in the sidebar.

                        // Find the newly created view (or existing one)
                        const views = useStore.getState().activeViews;
                        const view = views.find(v => v.name === name);
                        if (view) {
                            useStore.getState().setCurrentPath(null);
                            useStore.getState().setFilterConfig(view.filterConfig);
                            // We might need to track which active view is selected to highlight it in sidebar
                        }
                    }}>
                        <GitFork className="mr-2 h-4 w-4 rotate-180" /> Show Derived Assets
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    <ContextMenuSub>
                        <ContextMenuSubTrigger>
                            <StickyNote className="mr-2 h-4 w-4" />
                            Scratch Pad
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                            {useStore.getState().scratchPads.length === 0 ? (
                                <ContextMenuItem disabled className="text-muted-foreground italic">
                                    No Scratch Pads
                                </ContextMenuItem>
                            ) : (
                                useStore.getState().scratchPads.map(pad => (
                                    <ContextMenuItem
                                        key={pad.id}
                                        onClick={() => useStore.getState().addToScratchPad(pad.id, [asset.id])}
                                    >
                                        {pad.name}
                                    </ContextMenuItem>
                                ))
                            )}
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setIsCreateScratchPadDialogOpen(true);
                            }}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create New...
                            </ContextMenuItem>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                </ContextMenuContent>
            </ContextMenu>

            <CreateTagDialog
                isOpen={isCreateTagDialogOpen}
                onClose={() => setIsCreateTagDialogOpen(false)}
                onCreateTag={async (name, color) => {
                    const newTag = await createTag(name, color);
                    await addTagToAsset(asset.id, newTag.id);
                }}
            />

            <CreateScratchPadDialog
                isOpen={isCreateScratchPadDialogOpen}
                onClose={() => setIsCreateScratchPadDialogOpen(false)}
                onCreate={createScratchPad}
                initialAssetIds={[asset.id]}
            />

            <MetadataEditor
                isOpen={isMetadataEditorOpen}
                onClose={() => setIsMetadataEditorOpen(false)}
                asset={asset}
            />
        </>
    );
};
