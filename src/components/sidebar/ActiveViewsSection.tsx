import React from 'react';
import { GitFork, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SidebarSection } from './SidebarSection';

interface ActiveViewsSectionProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const ActiveViewsSection: React.FC<ActiveViewsSectionProps> = ({ isOpen, onToggle }) => {
    const activeViews = useStore(state => state.activeViews);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);
    const setCurrentPath = useStore(state => state.setCurrentPath);
    const removeActiveView = useStore(state => state.removeActiveView);

    return (
        <SidebarSection
            title="Active Views"
            isOpen={isOpen}
            onToggle={onToggle}
            className="mb-2"
        >
            {activeViews.map(view => (
                <div
                    key={view.id}
                    className={cn(
                        "flex items-center w-full hover:bg-accent/50 group pr-2 cursor-pointer",
                        JSON.stringify(filterConfig) === JSON.stringify(view.filterConfig) && "bg-accent text-accent-foreground"
                    )}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start gap-2 font-normal h-8 px-4 hover:bg-transparent min-w-0"
                        onClick={() => {
                            setFilterConfig(view.filterConfig);
                            setCurrentPath(null);
                        }}
                    >
                        <GitFork size={14} className="text-blue-500 rotate-180 shrink-0" />
                        <span className="truncate flex-1 min-w-0 text-left">{view.name}</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeActiveView(view.id);
                        }}
                    >
                        <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                    </Button>
                </div>
            ))}
            {activeViews.length === 0 && (
                <div className="px-4 py-2 text-xs text-muted-foreground italic">
                    No active views
                </div>
            )}
        </SidebarSection>
    );
};
