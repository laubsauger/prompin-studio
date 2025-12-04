import React, { useState } from 'react';
import { Check, ChevronsUpDown, X, Plus, Tag } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from './ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import { useStore } from '../store';

interface TagsMultiSelectProps {
    selectedTagIds: string[];
    onTagsChange: (tagIds: string[]) => void;
    onCreateTag?: () => void;
    className?: string;
}

export function TagsMultiSelect({
    selectedTagIds,
    onTagsChange,
    onCreateTag,
    className
}: TagsMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const tags = useStore(state => state.tags);

    const toggleTag = (tagId: string) => {
        if (selectedTagIds.includes(tagId)) {
            onTagsChange(selectedTagIds.filter(id => id !== tagId));
        } else {
            onTagsChange([...selectedTagIds, tagId]);
        }
    };

    const clearAll = () => {
        onTagsChange([]);
    };

    const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "h-8 justify-between text-xs min-w-[120px]",
                            selectedTagIds.length > 0 && "bg-purple-500/10 border-purple-500/50"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <Tag className="h-3 w-3" />
                            {selectedTagIds.length === 0 ? (
                                "Tags"
                            ) : selectedTagIds.length === 1 ? (
                                <div className="flex items-center gap-1.5">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: selectedTags[0]?.color || 'currentColor' }}
                                    />
                                    <span className="truncate max-w-[80px]">{selectedTags[0]?.name}</span>
                                </div>
                            ) : (
                                `${selectedTagIds.length} tags`
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search tags..." className="h-8 text-xs" />
                        {tags.length === 0 ? (
                            <div className="px-2 py-6 text-xs text-muted-foreground text-center">
                                No tags created yet
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>No tags found.</CommandEmpty>
                                <CommandGroup>
                                    {onCreateTag && (
                                        <>
                                            <CommandItem
                                                onSelect={() => {
                                                    setOpen(false);
                                                    onCreateTag();
                                                }}
                                                className="text-xs"
                                            >
                                                <Plus className="mr-2 h-3 w-3" />
                                                Create new tag...
                                            </CommandItem>
                                            <div className="border-t border-border my-1" />
                                        </>
                                    )}
                                    {tags.map(tag => {
                                        const isSelected = selectedTagIds.includes(tag.id);
                                        return (
                                            <CommandItem
                                                key={tag.id}
                                                value={tag.name}
                                                onSelect={() => toggleTag(tag.id)}
                                                className="text-xs"
                                            >
                                                <div
                                                    className={cn(
                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground"
                                                            : "opacity-50 [&_svg]:invisible"
                                                    )}
                                                >
                                                    <Check className={cn("h-3 w-3")} />
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: tag.color || 'currentColor' }}
                                                    />
                                                    <span className="truncate">{tag.name}</span>
                                                </div>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </>
                        )}
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedTagIds.length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="h-8 w-6 p-0"
                    title="Clear tag filter"
                >
                    <X className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}