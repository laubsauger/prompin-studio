import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, RefreshCw, Inbox, Star, X, StickyNote, CheckCircle, AlertCircle, Tag } from 'lucide-react';
import { useStore } from '../store';
import { debounce } from '../utils/debounce';
import { cn } from '../lib/utils';
import {
    Command,
    CommandInput,
    CommandList,
    CommandGroup,
    CommandItem,
    CommandSeparator,
} from './ui/command';
import { CreateScratchPadDialog } from './CreateScratchPadDialog';
import { CreateTagDialog } from './CreateTagDialog';

export function SearchPalette() {
    const {
        searchQuery,
        setSearchQuery,
        searchAssets,
        previewSearch,
        triggerResync,
        setCurrentPath,
        setFilterConfig,
        selectedIds,
        updateAssetStatus,
        createScratchPad,
        clearSelection,
        setViewingAssetId
    } = useStore();
    // const assets = useStore(state => state.assets); // Don't use global assets
    const [assets, setAssets] = useState<any[]>([]); // Local assets state
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(searchQuery);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [isCreateScratchPadDialogOpen, setIsCreateScratchPadDialogOpen] = useState(false);
    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);

    // Create a stable debounced search function using useMemo
    const debouncedSearch = useMemo(
        () => debounce(async (query: string, searchFn: typeof previewSearch) => {
            if (!query.trim()) {
                setAssets([]);
                setIsSearching(false);
                setHasSearched(false);
                return;
            }
            setIsSearching(true);
            // Use previewSearch instead of searchAssets to avoid updating global state
            const results = await searchFn(query);
            setAssets(results);
            setIsSearching(false);
            setHasSearched(true);
        }, 300),
        [] // Empty deps since we pass searchFn as parameter
    );

    // Wrapper to use current previewSearch
    const handleSearch = useCallback((query: string) => {
        debouncedSearch(query, previewSearch);
    }, [previewSearch, debouncedSearch]);

    useEffect(() => {
        // Sync local value with global search query when opening
        if (open) {
            setValue(searchQuery);
            if (searchQuery) {
                handleSearch(searchQuery);
            } else {
                setAssets([]);
            }
        } else {
            // Reset search state when closing
            setHasSearched(false);
            setIsSearching(false);
        }
    }, [open, searchQuery, handleSearch]);

    const handleValueChange = (value: string) => {
        setValue(value);
        handleSearch(value);
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
                    "relative h-7 w-40 flex items-center gap-2 px-2",
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
                    className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="fixed left-[50%] top-[20%] z-50 w-full max-w-2xl translate-x-[-50%] p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Command
                            className="rounded-lg border shadow-md bg-popover"
                            shouldFilter={false}
                        >
                            <CommandInput
                                placeholder="Search files, metadata, projects..."
                                value={value}
                                onValueChange={handleValueChange}
                                onClear={() => handleValueChange('')}
                                autoFocus
                            />
                            <CommandList className="max-h-[500px]">
                                {/* Don't show CommandEmpty by default */}

                                {/* Loading state */}
                                {isSearching && value.trim() && (
                                    <div className="py-6 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
                                    </div>
                                )}

                                {/* Global Actions - Fixed section at top */}
                                {!isSearching && (
                                    <CommandGroup heading="Tools">
                                    {value && (
                                        <CommandItem onSelect={() => {
                                            setSearchQuery(value);
                                            searchAssets(value);
                                            setOpen(false);
                                        }}>
                                            <Search className="mr-2 h-4 w-4" />
                                            <span>Search for "{value}"</span>
                                        </CommandItem>
                                    )}
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
                                        setFilterConfig({
                                            likedOnly: false,
                                            status: undefined,
                                            type: 'all',
                                            tagId: null,
                                            scratchPadId: null,
                                            relatedToAssetId: undefined
                                        });
                                        setSearchQuery('');
                                        setOpen(false);
                                    }}>
                                        <X className="mr-2 h-4 w-4" />
                                        <span>Clear Filters & Search</span>
                                    </CommandItem>
                                </CommandGroup>
                                )}

                                {/* Selection Actions */}
                                {!isSearching && selectedIds.size > 0 && (
                                    <>
                                        <CommandSeparator />
                                        <CommandGroup heading={`Selection Actions (${selectedIds.size} selected)`}>
                                            <CommandItem onSelect={() => {
                                                setIsCreateScratchPadDialogOpen(true);
                                                setOpen(false);
                                            }}>
                                                <StickyNote className="mr-2 h-4 w-4" />
                                                <span>Create Scratch Pad from Selection</span>
                                            </CommandItem>
                                            <CommandItem onSelect={() => {
                                                setIsCreateTagDialogOpen(true);
                                                setOpen(false);
                                            }}>
                                                <Tag className="mr-2 h-4 w-4" />
                                                <span>Add Tag to Selection...</span>
                                            </CommandItem>
                                            <CommandItem onSelect={() => {
                                                Array.from(selectedIds).forEach(id => updateAssetStatus(id, 'approved'));
                                                setOpen(false);
                                            }}>
                                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                                <span>Mark as Approved</span>
                                            </CommandItem>
                                            <CommandItem onSelect={() => {
                                                Array.from(selectedIds).forEach(id => updateAssetStatus(id, 'review_requested'));
                                                setOpen(false);
                                            }}>
                                                <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
                                                <span>Mark as Review Requested</span>
                                            </CommandItem>
                                            <CommandItem onSelect={() => {
                                                clearSelection();
                                                setOpen(false);
                                            }}>
                                                <X className="mr-2 h-4 w-4" />
                                                <span>Clear Selection</span>
                                            </CommandItem>
                                        </CommandGroup>
                                    </>
                                )}

                                {/* No results message */}
                                {!isSearching && hasSearched && assets.length === 0 && value.trim() && (
                                    <>
                                        <CommandSeparator />
                                        <div className="py-6 text-center">
                                            <p className="text-sm font-medium text-muted-foreground">No results found</p>
                                            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search terms</p>
                                        </div>
                                    </>
                                )}

                                {/* Search Results */}
                                {!isSearching && assets.length > 0 && (
                                    <>
                                        <CommandSeparator />
                                        <CommandGroup heading={`Results (${assets.length})`}>
                                            {assets.slice(0, 50).map(asset => {
                                                const isNew = asset.status === 'unsorted' && asset.createdAt > useStore.getState().lastInboxViewTime;
                                                return (
                                                    <CommandItem
                                                        key={asset.id}
                                                        value={asset.id}
                                                        onSelect={() => {
                                                            setViewingAssetId(asset.id);
                                                            setOpen(false);
                                                        }}
                                                        className="flex items-center gap-3"
                                                    >
                                                        <div className="w-8 h-8 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center relative">
                                                            {/* New indicator dot */}
                                                            {isNew && (
                                                                <div className="absolute -top-1 -left-1 z-10">
                                                                    <div className="w-2 h-2 bg-green-500 rounded-full border border-background" />
                                                                </div>
                                                            )}
                                                            {asset.type === 'image' ? (
                                                                <img
                                                                    src={asset.thumbnailPath ? `thumbnail://${asset.thumbnailPath}` : `media://${asset.path}`}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                            ) : asset.thumbnailPath ? (
                                                                <img
                                                                    src={`thumbnail://${asset.thumbnailPath}`}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                <div className="text-[8px] text-muted-foreground">Video</div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden flex-1">
                                                            <span className="truncate text-sm font-medium">{asset.path.split('/').pop()}</span>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                                                                <span className="truncate max-w-[200px]">{asset.path}</span>
                                                                {asset.metadata.prompt && (
                                                                    <>
                                                                        <span className="shrink-0 opacity-50">•</span>
                                                                        <span className="truncate italic opacity-70">"{asset.metadata.prompt}"</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {asset.metadata.platform && (
                                                            <div className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground shrink-0">
                                                                {asset.metadata.platform}
                                                            </div>
                                                        )}
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </>
                                )}
                            </CommandList>
                        </Command>
                    </div>
                </div>
            )}

            <CreateScratchPadDialog
                isOpen={isCreateScratchPadDialogOpen}
                onClose={() => setIsCreateScratchPadDialogOpen(false)}
                onCreate={createScratchPad}
                initialAssetIds={Array.from(selectedIds)}
            />

            <CreateTagDialog
                isOpen={isCreateTagDialogOpen}
                onClose={() => setIsCreateTagDialogOpen(false)}
                onCreateTag={async (name, color) => {
                    const tag = await useStore.getState().createTag(name, color);
                    // Add to selected assets
                    const promises = Array.from(selectedIds).map(id =>
                        useStore.getState().addTagToAsset(id, tag.id)
                    );
                    await Promise.all(promises);
                }}
            />
        </>
    );
}