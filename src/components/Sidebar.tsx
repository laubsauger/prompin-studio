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
            <button
                className={cn(
                    "absolute top-16 z-50 flex items-center justify-center bg-card border border-border shadow-sm hover:bg-accent/50 transition-all duration-200 group",
                    isCollapsed
                        ? "left-0 px-1 py-4 rounded-r-md border-l-0"
                        : "-right-[13px] px-0.5 py-3 rounded-md"
                )}
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {isCollapsed ? (
                    <ChevronRight className="h-4 w-3 text-muted-foreground group-hover:text-foreground" />
                ) : (
                    <ChevronLeft className="h-4 w-3 text-muted-foreground group-hover:text-foreground" />
                )}
            </button>

            <div className={cn("flex-1 flex flex-col overflow-hidden w-64", isCollapsed && "hidden")}>
                <div className="flex-1 overflow-y-auto pb-4">
                    <LibrarySection
                        isOpen={isLibraryOpen}
                        onToggle={() => setIsLibraryOpen(!isLibraryOpen)}
                    />

                    <ActiveViewsSection
                        isOpen={isActiveViewsOpen}
                        onToggle={() => setIsActiveViewsOpen(!isActiveViewsOpen)}
                    />

                    <FolderTreeSection
                        isOpen={isFoldersOpen}
                        onToggle={() => setIsFoldersOpen(!isFoldersOpen)}
                    />

                    <StatusFilterSection
                        isOpen={isStatusOpen}
                        onToggle={() => setIsStatusOpen(!isStatusOpen)}
                    />

                    <TagListSection
                        isOpen={isTagsOpen}
                        onToggle={() => setIsTagsOpen(!isTagsOpen)}
                        onOpenCreateDialog={() => setIsCreateTagDialogOpen(true)}
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
