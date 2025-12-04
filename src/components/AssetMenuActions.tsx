import React from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import { FolderOpen, Heart, Plus, Tag, FileText, GitFork, StickyNote, Sparkles } from 'lucide-react';

// Generic types for menu components to allow reuse between ContextMenu and DropdownMenu
interface MenuComponents {
    Item: React.ComponentType<any>;
    Separator: React.ComponentType<any>;
    Sub: React.ComponentType<any>;
    SubTrigger: React.ComponentType<any>;
    SubContent: React.ComponentType<any>;
    Label?: React.ComponentType<any>; // Optional as ContextMenu might not use it the same way
}

interface AssetMenuActionsProps {
    asset: Asset;
    components: MenuComponents;
    onClose?: () => void;
    onEditMetadata?: () => void;
    onCreateTag?: () => void;
    onCreateScratchPad?: () => void;
}

export const AssetMenuActions: React.FC<AssetMenuActionsProps> = ({
    asset,
    components,
    onClose,
    onEditMetadata,
    onCreateTag,
    onCreateScratchPad
}) => {
    const { Item, Separator, Sub, SubTrigger, SubContent } = components;

    const toggleLike = useStore(state => state.toggleLike);
    const tags = useStore(state => state.tags);
    const addTagToAsset = useStore(state => state.addTagToAsset);
    const removeTagFromAsset = useStore(state => state.removeTagFromAsset);
    const scratchPads = useStore(state => state.scratchPads);
    const addToScratchPad = useStore(state => state.addToScratchPad);
    const updateAssetStatus = useStore(state => state.updateAssetStatus);
    const setLineageAssetId = useStore(state => state.setLineageAssetId);
    const addActiveView = useStore(state => state.addActiveView);
    const setCurrentPath = useStore(state => state.setCurrentPath);
    const setFilterConfig = useStore(state => state.setFilterConfig);
    const setViewMode = useStore(state => state.setViewMode);
    const setViewingAssetId = useStore(state => state.setViewingAssetId);

    const statusConfig = ASSET_STATUSES[asset.status] || ASSET_STATUSES.unsorted;



    return (
        <>
            <Item onClick={(e: any) => {
                e.stopPropagation();
                toggleLike(asset.id);
                onClose?.();
            }}>
                <Heart className={cn("mr-2 h-4 w-4", asset.metadata.liked && "fill-current text-red-500")} />
                {asset.metadata.liked ? 'Unlike' : 'Like'}
            </Item>

            <Sub>
                <SubTrigger>
                    <div className="flex items-center">
                        <div className={cn("w-2 h-2 rounded-full mr-2", statusConfig.color)} />
                        Status
                    </div>
                </SubTrigger>
                <SubContent>
                    {Object.entries(ASSET_STATUSES).map(([key, config]) => (
                        <Item
                            key={key}
                            onClick={(e: any) => {
                                e.stopPropagation();
                                updateAssetStatus(asset.id, key as any);
                                onClose?.();
                            }}
                        >
                            <div className={cn("w-2 h-2 rounded-full mr-2", config.color)} />
                            {config.label}
                            {asset.status === key && <span className="ml-auto text-xs">✓</span>}
                        </Item>
                    ))}
                </SubContent>
            </Sub>

            <Sub>
                <SubTrigger>
                    <Tag className="mr-2 h-4 w-4" />
                    Tags
                </SubTrigger>
                <SubContent className="w-48">
                    <Item onSelect={(e: any) => {
                        e.preventDefault();
                        onCreateTag?.();
                    }}
                        onClick={(e: any) => e.stopPropagation()}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Create New Tag...
                    </Item>
                    <Separator />
                    {tags.length === 0 ? (
                        <Item disabled className="text-muted-foreground italic">
                            No Tags
                        </Item>
                    ) : (
                        tags.map(tag => {
                            const hasTag = asset.tags?.some(t => t.id === tag.id);
                            return (
                                <Item
                                    key={tag.id}
                                    onClick={(e: any) => {
                                        e.stopPropagation();
                                        if (hasTag) {
                                            removeTagFromAsset(asset.id, tag.id);
                                        } else {
                                            addTagToAsset(asset.id, tag.id);
                                        }
                                        // Don't close on tag toggle to allow multiple
                                    }}
                                >
                                    <Tag className="w-4 h-4 mr-2" style={{ color: tag.color }} />
                                    {tag.name}
                                    {hasTag && <span className="ml-auto text-xs">✓</span>}
                                </Item>
                            );
                        })
                    )}
                </SubContent>
            </Sub>

            <Item onClick={(e: any) => {
                e.stopPropagation();
                onEditMetadata?.();
                onClose?.();
            }}>
                <FileText className="mr-2 h-4 w-4" /> Edit Metadata...
            </Item>

            <Item onClick={async (e: any) => {
                e.stopPropagation();
                const ipc = (window as any).ipcRenderer;
                if (ipc) {
                    await ipc.invoke('reveal-in-finder', asset.path);
                }
                onClose?.();
            }}>
                <FolderOpen className="mr-2 h-4 w-4" /> Show in Finder
            </Item>

            <Separator />

            <Item onClick={(e: any) => {
                e.stopPropagation();
                setLineageAssetId(asset.id);
                onClose?.();
            }}>
                <GitFork className="mr-2 h-4 w-4" /> View Lineage
            </Item>

            <Item onClick={(e: any) => {
                e.stopPropagation();
                const name = `Similar to ${asset.path.split('/').pop()}`;
                addActiveView(name, {
                    relatedToAssetId: asset.id,
                    semantic: true,
                    type: 'all',
                    status: 'all',
                    likedOnly: false,
                });
                const views = useStore.getState().activeViews;
                const view = views.find(v => v.name === name);
                if (view) {
                    setCurrentPath(null);
                    setFilterConfig(view.filterConfig);
                    setViewMode('grid');
                    setViewingAssetId(null);
                    // window.scrollTo({ top: 0, behavior: 'smooth' }); // Can't easily access window here, maybe ok
                }
                onClose?.();
            }}>
                <Sparkles className="mr-2 h-4 w-4 text-purple-400" /> Find Similar
            </Item>

            <Item onClick={(e: any) => {
                e.stopPropagation();
                const name = `Derived from ${asset.path.split('/').pop()}`;
                addActiveView(name, {
                    relatedToAssetId: asset.id,
                    type: 'all',
                    status: 'all',
                    likedOnly: false,
                });
                const views = useStore.getState().activeViews;
                const view = views.find(v => v.name === name);
                if (view) {
                    setCurrentPath(null);
                    setFilterConfig(view.filterConfig);
                }
                onClose?.();
            }}>
                <GitFork className="mr-2 h-4 w-4 rotate-180" /> Show Derived Assets
            </Item>

            <Separator />

            <Sub>
                <SubTrigger>
                    <StickyNote className="mr-2 h-4 w-4" />
                    Scratch Pad
                </SubTrigger>
                <SubContent className="w-48">
                    {scratchPads.length === 0 ? (
                        <Item disabled className="text-muted-foreground italic">
                            No Scratch Pads
                        </Item>
                    ) : (
                        scratchPads.map(pad => (
                            <Item
                                key={pad.id}
                                onClick={() => {
                                    addToScratchPad(pad.id, [asset.id]);
                                    onClose?.();
                                }}
                            >
                                {pad.name}
                            </Item>
                        ))
                    )}
                    <Separator />
                    <Item onClick={(e: any) => {
                        e.stopPropagation();
                        onCreateScratchPad?.();
                        onClose?.();
                    }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New...
                    </Item>
                </SubContent>
            </Sub>
        </>
    );
};
