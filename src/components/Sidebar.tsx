import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { CreateTagDialog } from './CreateTagDialog';
import { CreateScratchPadDialog } from './CreateScratchPadDialog';

import { LibrarySection } from './sidebar/LibrarySection';
import { FolderTreeSection } from './sidebar/FolderTreeSection';
import { TagListSection } from './sidebar/TagListSection';
import { StatusFilterSection } from './sidebar/StatusFilterSection';
import { ActiveViewsSection } from './sidebar/ActiveViewsSection';
import { ScratchPadSection } from './sidebar/ScratchPadSection';

export const Sidebar: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);
    const [isCreateScratchPadDialogOpen, setIsCreateScratchPadDialogOpen] = useState(false);

    // Section collapse states
    const [isLibraryOpen, setIsLibraryOpen] = useState(true);
    const [isFoldersOpen, setIsFoldersOpen] = useState(true);
    const [isTagsOpen, setIsTagsOpen] = useState(true);
    const [isStatusOpen, setIsStatusOpen] = useState(true);
    const [isActiveViewsOpen, setIsActiveViewsOpen] = useState(true);
    const [isScratchPadsOpen, setIsScratchPadsOpen] = useState(true);

    const createTag = useStore(state => state.createTag);
    const createScratchPad = useStore(state => state.createScratchPad);

    return (
        <div
            className={cn(
                "border-r border-border bg-card flex flex-col h-full transition-all duration-300 relative",
                isCollapsed ? "w-0 border-none" : "w-64"
            )}
        >
            <div className="absolute -right-3 top-3 z-50">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-accent"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                </Button>
            </div>

            <div className={cn("flex-1 flex flex-col overflow-hidden w-64", isCollapsed && "hidden")}>
                <div className="flex-1 overflow-y-auto py-4">
                    <LibrarySection
                        isOpen={isLibraryOpen}
                        onToggle={() => setIsLibraryOpen(!isLibraryOpen)}
                    />

                    <FolderTreeSection
                        isOpen={isFoldersOpen}
                        onToggle={() => setIsFoldersOpen(!isFoldersOpen)}
                    />

                    <TagListSection
                        isOpen={isTagsOpen}
                        onToggle={() => setIsTagsOpen(!isTagsOpen)}
                        onOpenCreateDialog={() => setIsCreateTagDialogOpen(true)}
                    />

                    <StatusFilterSection
                        isOpen={isStatusOpen}
                        onToggle={() => setIsStatusOpen(!isStatusOpen)}
                    />

                    <ActiveViewsSection
                        isOpen={isActiveViewsOpen}
                        onToggle={() => setIsActiveViewsOpen(!isActiveViewsOpen)}
                    />

                    <ScratchPadSection
                        isOpen={isScratchPadsOpen}
                        onToggle={() => setIsScratchPadsOpen(!isScratchPadsOpen)}
                        onOpenCreateDialog={() => setIsCreateScratchPadDialogOpen(true)}
                    />
                </div>
            </div>

            <CreateTagDialog
                isOpen={isCreateTagDialogOpen}
                onClose={() => setIsCreateTagDialogOpen(false)}
                onCreateTag={createTag}
            />
            <CreateScratchPadDialog
                isOpen={isCreateScratchPadDialogOpen}
                onClose={() => setIsCreateScratchPadDialogOpen(false)}
                onCreate={createScratchPad}
            />
        </div>
    );
};
