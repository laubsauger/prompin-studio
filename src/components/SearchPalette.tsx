import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, RefreshCw, Inbox, Star, X } from 'lucide-react';
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
    const {
        searchQuery,
        setSearchQuery,
        searchAssets,
        triggerResync,
        setCurrentPath,
        setFilterConfig
    } = useStore();
    const assets = useStore(state => state.assets);
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

    // Keyboard shortcuts to open/close search
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }

            // Close on Escape when open
            if (e.key === 'Escape' && open) {
                e.preventDefault();
                setOpen(false);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [open]);

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
                        <Command className="rounded-lg border shadow-md bg-popover">
                            <CommandInput
                                placeholder="Search files, metadata, projects..."
                                value={value}
                                onValueChange={handleValueChange}
                                autoFocus
                            />
                            <CommandList className="max-h-[500px]">
                                <CommandEmpty>No results found.</CommandEmpty>
                                {value && (
                                    <CommandGroup heading="Results">
                                        <CommandItem className="flex items-center justify-between pointer-events-none">
                                            <span>Found {assets.length} assets</span>
                                        </CommandItem>
                                        <div className="grid grid-cols-6 gap-2 p-2">
                                            {assets.slice(0, 12).map(asset => (
                                                <div key={asset.id} className="aspect-square rounded overflow-hidden bg-muted relative">
                                                    {asset.type === 'image' ? (
                                                        <img
                                                            src={`media://${asset.rootPath}/${asset.path}`}
                                                            alt={asset.path}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                                            Video
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {assets.length > 12 && (
                                            <div className="p-2 text-xs text-muted-foreground text-center">
                                                + {assets.length - 12} more
                                            </div>
                                        )}
                                    </CommandGroup>
                                )}
                                <CommandGroup heading="Actions">
                                    <CommandItem onSelect={() => {
                                        triggerResync();
                                        setOpen(false);
                                    }}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        <span>Resync Library</span>
                                    </CommandItem>
                                    <CommandItem onSelect={() => {
                                        setCurrentPath(null);
                                        setFilterConfig({ status: 'unsorted', likedOnly: false });
                                        useStore.getState().setLastInboxViewTime(Date.now());
                                        setOpen(false);
                                    }}>
                                        <Inbox className="mr-2 h-4 w-4" />
                                        <span>Go to Inbox</span>
                                    </CommandItem>
                                    <CommandItem onSelect={() => {
                                        setCurrentPath(null);
                                        setFilterConfig({ likedOnly: true, status: undefined });
                                        setOpen(false);
                                    }}>
                                        <Star className="mr-2 h-4 w-4" />
                                        <span>Go to Favorites</span>
                                    </CommandItem>
                                    <CommandItem onSelect={() => {
                                        setCurrentPath(null);
                                        setFilterConfig({ likedOnly: false, status: undefined, type: 'all', tagId: null, scratchPadId: null });
                                        setSearchQuery('');
                                        setOpen(false);
                                    }}>
                                        <X className="mr-2 h-4 w-4" />
                                        <span>Clear Filters & Search</span>
                                    </CommandItem>
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </div>
                </div>
            )}
        </>
    );
}