import React from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SidebarSection } from './SidebarSection';

interface TagListSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    onOpenCreateDialog: () => void;
}

export const TagListSection: React.FC<TagListSectionProps> = ({ isOpen, onToggle, onOpenCreateDialog }) => {
    const tags = useStore(state => state.tags);
    const assets = useStore(state => state.assets);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);
    const deleteTag = useStore(state => state.deleteTag);

    return (
        <SidebarSection
            title="Tags"
            isOpen={isOpen}
            onToggle={onToggle}
            action={
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={onOpenCreateDialog}>
                    <Plus className="h-3 w-3" />
                </Button>
            }
        >
            {tags.length === 0 ? (
                <div className="px-4 py-2 text-xs text-muted-foreground italic">No tags found</div>
            ) : (
                tags.map(tag => {
                    const count = assets.filter(a => a.tags?.some(t => t.id === tag.id)).length;
                    return (
                        <div
                            key={tag.id}
                            className={cn(
                                "flex items-center w-full hover:bg-accent/50 group pr-2",
                                filterConfig.tagId === tag.id && "bg-accent text-accent-foreground",
                                count === 0 && "opacity-50"
                            )}
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 justify-start gap-2 h-7 px-4 hover:bg-transparent min-w-0"
                                onClick={() => {
                                    setFilterConfig({
                                        tagId: filterConfig.tagId === tag.id ? null : tag.id
                                    });
                                }}
                            >
                                <Tag className="h-3 w-3 shrink-0" style={{ color: tag.color || 'currentColor' }} />
                                <span className="flex-1 text-left text-xs truncate min-w-0">{tag.name}</span>
                                <span className="text-[10px] text-muted-foreground opacity-70 shrink-0">{count}</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete tag "${tag.name}"?`)) {
                                        deleteTag(tag.id);
                                    }
                                }}
                            >
                                <Trash2 size={12} className="text-destructive" />
                            </Button>
                        </div>
                    );
                })
            )}
        </SidebarSection>
    );
};
