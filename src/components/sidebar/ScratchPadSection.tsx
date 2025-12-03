import React from 'react';
import { Plus, StickyNote, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SidebarSection } from './SidebarSection';

interface ScratchPadSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    onOpenCreateDialog: () => void;
}

export const ScratchPadSection: React.FC<ScratchPadSectionProps> = ({ isOpen, onToggle, onOpenCreateDialog }) => {
    const scratchPads = useStore(state => state.scratchPads);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);
    const setCurrentPath = useStore(state => state.setCurrentPath);
    const deleteScratchPad = useStore(state => state.deleteScratchPad);

    return (
        <SidebarSection
            title="Scratch Pads"
            isOpen={isOpen}
            onToggle={onToggle}
            className="mb-8"
            action={
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 hover:bg-transparent"
                    onClick={onOpenCreateDialog}
                >
                    <Plus size={12} />
                </Button>
            }
        >
            {scratchPads.map(pad => (
                <div
                    key={pad.id}
                    className={cn(
                        "flex items-center w-full hover:bg-accent/50 group pr-2 cursor-pointer",
                        filterConfig.scratchPadId === pad.id && "bg-accent text-accent-foreground"
                    )}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start gap-2 font-normal h-8 px-4 hover:bg-transparent min-w-0"
                        onClick={() => {
                            setFilterConfig({ scratchPadId: pad.id });
                            setCurrentPath(null);
                        }}
                    >
                        <StickyNote size={14} className="text-yellow-500 shrink-0" />
                        <span className="truncate flex-1 min-w-0 text-left">{pad.name}</span>
                        <span className="text-[10px] text-muted-foreground opacity-70 shrink-0 ml-1">
                            {pad.assetIds.length}
                        </span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete scratch pad "${pad.name}"?`)) {
                                deleteScratchPad(pad.id);
                            }
                        }}
                    >
                        <Trash2 size={12} className="text-destructive" />
                    </Button>
                </div>
            ))}
            {scratchPads.length === 0 && (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                    No scratch pads
                </div>
            )}
        </SidebarSection>
    );
};
