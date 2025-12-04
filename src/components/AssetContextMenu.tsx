import React, { useState } from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';
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
import { CreateScratchPadDialog } from './CreateScratchPadDialog';
import { MetadataEditor } from './MetadataEditor';
import { AssetMenuActions } from './AssetMenuActions';

interface AssetContextMenuProps {
    asset: Asset;
    children: React.ReactNode;
}

export const AssetContextMenu: React.FC<AssetContextMenuProps> = ({ asset, children }) => {
    const createTag = useStore(state => state.createTag);
    const addTagToAsset = useStore(state => state.addTagToAsset);
    const createScratchPad = useStore(state => state.createScratchPad);

    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);
    const [isCreateScratchPadDialogOpen, setIsCreateScratchPadDialogOpen] = useState(false);
    const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    {children}
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <AssetMenuActions
                        asset={asset}
                        components={{
                            Item: ContextMenuItem,
                            Separator: ContextMenuSeparator,
                            Sub: ContextMenuSub,
                            SubTrigger: ContextMenuSubTrigger,
                            SubContent: ContextMenuSubContent,
                            // ContextMenu doesn't usually use Label in the same way, but we can pass a dummy or compatible one if needed
                            // For now, AssetMenuActions doesn't use Label heavily or we can adapt
                            Label: ({ children }: any) => <div className="px-2 py-1.5 text-sm font-semibold text-foreground">{children}</div>
                        }}
                        onEditMetadata={() => setIsMetadataEditorOpen(true)}
                        onCreateTag={() => setIsCreateTagDialogOpen(true)}
                        onCreateScratchPad={() => setIsCreateScratchPadDialogOpen(true)}
                    />
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
