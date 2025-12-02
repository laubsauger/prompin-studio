import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { debounce } from '../utils/debounce';
import { cn } from '../lib/utils';
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from './ui/command';

export function SearchPalette() {
    const { searchQuery, setSearchQuery, searchAssets } = useStore();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(searchQuery);
    const [isSearching, setIsSearching] = useState(false);

    // Debounced search function
    const debouncedSearch = useCallback(
        debounce(async (query: string) => {
            setIsSearching(true);
            setSearchQuery(query);
            await searchAssets(query);
            setIsSearching(false);
        }, 300),
        []
    );

    useEffect(() => {
        setValue(searchQuery);
    }, [searchQuery]);

    const handleValueChange = (value: string) => {
        setValue(value);
        debouncedSearch(value);
    };

    // Keyboard shortcut to open search
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    "relative h-7 w-64 flex items-center gap-2 px-2",
                    "bg-secondary/50 border border-border rounded",
                    "text-muted-foreground text-xs",
                    "hover:bg-secondary/70 transition-colors"
                )}
            >
                {isSearching ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                    <Search className="w-3 h-3" />
                )}
                <span className="flex-1 text-left">
                    {searchQuery || "Search..."}
                </span>
                {!isSearching && (
                    <kbd className="pointer-events-none select-none h-4 rounded border bg-muted px-1 font-mono text-[10px]">
                        ⌘K
                    </kbd>
                )}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="fixed left-[50%] top-[20%] z-50 w-full max-w-2xl translate-x-[-50%] p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Command className="rounded-lg border shadow-md">
                            <CommandInput
                                placeholder="Search files, metadata, projects..."
                                value={value}
                                onValueChange={handleValueChange}
                            />
                            <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                {/* Results will be shown here if we want to add suggestions */}
                            </CommandList>
                        </Command>
                    </div>
                </div>
            )}
        </>
    );
}