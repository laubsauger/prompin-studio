import { useState } from 'react';
import { SlidersHorizontal, Calendar, Film, Cpu, Sparkles, X, Search, Heart, Bookmark, Tag } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui/button';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../lib/utils';


export function AdvancedFilters() {
    const [isOpen, setIsOpen] = useState(false);
    const { filterConfig, setFilterConfig, searchAssets, assets, resetFilters, searchQuery, setSearchQuery, scratchPads, tags } = useStore();

    const handleFilterChange = (key: string, value: any) => {
        const newConfig = { ...filterConfig, [key]: value };
        setFilterConfig(newConfig);
        searchAssets(undefined, newConfig);
    };

    const clearFilters = () => {
        resetFilters();
        setSearchQuery('');
    };

    // Count active filters including searchQuery
    let activeFilterCount = Object.entries(filterConfig).filter(([key, value]) => {
        // Skip default/empty values
        if (key === 'type' && value === 'all') return false;
        if (key === 'status' && value === 'all') return false;
        if (key === 'likedOnly' && !value) return false;
        if (key === 'semantic' && !value) return false;
        // Handle empty arrays (statuses, tagIds)
        if (Array.isArray(value) && value.length === 0) return false;
        // Handle null, undefined, empty string
        if (value === null || value === undefined || value === '') return false;
        return true;
    }).length;

    // Add searchQuery to count if it exists
    if (searchQuery && searchQuery.trim() !== '') {
        activeFilterCount++;
    }

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-8 gap-1.5 px-2.5 text-xs",
                        activeFilterCount > 0 && "bg-purple-500/10 border-purple-500/50"
                    )}
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Advanced</span>
                    {activeFilterCount > 0 && (
                        <span className="ml-0.5 px-1 py-0 text-[10px] bg-purple-500 text-white rounded-full min-w-[16px] text-center">
                            {activeFilterCount}
                        </span>
                    )}
                </Button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="z-50 w-80 rounded-lg bg-popover border border-border shadow-xl"
                    sideOffset={5}
                >
                    <div className="p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold">Advanced Filters</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="h-6 text-xs px-2"
                            >
                                Clear All
                            </Button>
                        </div>

                        {/* Active Search Query */}
                        {searchQuery && searchQuery.trim() !== '' && (
                            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 space-y-1.5">
                                <div className="text-[11px] font-medium text-blue-500 flex items-center gap-1.5">
                                    <Search className="h-3 w-3" />
                                    Active Search
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs truncate flex-1" title={searchQuery}>
                                        "{searchQuery}"
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0 hover:bg-blue-500/20"
                                        onClick={() => {
                                            setSearchQuery('');
                                            searchAssets('', filterConfig);
                                        }}
                                        title="Clear Search"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Liked Only Filter */}
                        {filterConfig.likedOnly && (
                            <div className="p-2 rounded bg-pink-500/10 border border-pink-500/20 space-y-1.5">
                                <div className="text-[11px] font-medium text-pink-500 flex items-center gap-1.5">
                                    <Heart className="h-3 w-3" />
                                    Liked Only
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs">Showing only liked assets</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0 hover:bg-pink-500/20"
                                        onClick={() => handleFilterChange('likedOnly', false)}
                                        title="Clear Liked Filter"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Scratch Pad Filter */}
                        {filterConfig.scratchPadId && (
                            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                                <div className="text-[11px] font-medium text-amber-500 flex items-center gap-1.5">
                                    <Bookmark className="h-3 w-3" />
                                    Scratch Pad
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs truncate flex-1">
                                        {scratchPads.find(p => p.id === filterConfig.scratchPadId)?.name || 'Unknown Scratch Pad'}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0 hover:bg-amber-500/20"
                                        onClick={() => handleFilterChange('scratchPadId', null)}
                                        title="Clear Scratch Pad Filter"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Legacy Single Tag Filter */}
                        {filterConfig.tagId && (
                            <div className="p-2 rounded bg-green-500/10 border border-green-500/20 space-y-1.5">
                                <div className="text-[11px] font-medium text-green-500 flex items-center gap-1.5">
                                    <Tag className="h-3 w-3" />
                                    Tag Filter
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs truncate flex-1">
                                        {tags.find(t => t.id === filterConfig.tagId)?.name || 'Unknown Tag'}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0 hover:bg-green-500/20"
                                        onClick={() => handleFilterChange('tagId', null)}
                                        title="Clear Tag Filter"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Active Context (Similarity/Lineage) */}
                        {filterConfig.relatedToAssetId && (
                            <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 space-y-1.5">
                                <div className="text-[11px] font-medium text-purple-500 flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" />
                                    Active Context
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs truncate flex-1" title={filterConfig.relatedToAssetId}>
                                        {filterConfig.semantic ? 'Similar to ' : 'Derived from '}
                                        <span className="font-mono opacity-70">
                                            {/* We ideally want the filename here, but we only have ID. 
                                                We can try to find it in the assets store if loaded. */}
                                            {assets.find(a => a.id === filterConfig.relatedToAssetId)?.path.split('/').pop() || 'Asset'}
                                        </span>
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0 hover:bg-purple-500/20"
                                        onClick={() => handleFilterChange('relatedToAssetId', undefined)}
                                        title="Clear Context"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Production Metadata */}
                        <div className="space-y-2">
                            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                <Film className="h-3 w-3" />
                                Production
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <input
                                    type="text"
                                    placeholder="Project"
                                    value={filterConfig.project || ''}
                                    onChange={(e) => handleFilterChange('project', e.target.value || undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <input
                                    type="text"
                                    placeholder="Scene"
                                    value={filterConfig.scene || ''}
                                    onChange={(e) => handleFilterChange('scene', e.target.value || undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <input
                                    type="text"
                                    placeholder="Shot"
                                    value={filterConfig.shot || ''}
                                    onChange={(e) => handleFilterChange('shot', e.target.value || undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <input
                                    type="text"
                                    placeholder="Author ID"
                                    value={filterConfig.authorId || ''}
                                    onChange={(e) => handleFilterChange('authorId', e.target.value || undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>
                        </div>

                        {/* AI Model Metadata */}
                        <div className="space-y-2">
                            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                <Cpu className="h-3 w-3" />
                                AI Model
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <input
                                    type="text"
                                    placeholder="Platform"
                                    value={filterConfig.platform || ''}
                                    onChange={(e) => handleFilterChange('platform', e.target.value || undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <input
                                    type="text"
                                    placeholder="Model"
                                    value={filterConfig.model || ''}
                                    onChange={(e) => handleFilterChange('model', e.target.value || undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>
                        </div>

                        {/* Date Range */}
                        <div className="space-y-2">
                            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                Date Range
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <input
                                    type="date"
                                    value={filterConfig.dateFrom ? new Date(filterConfig.dateFrom).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <input
                                    type="date"
                                    value={filterConfig.dateTo ? new Date(filterConfig.dateTo).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                                    className="px-2 py-1 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>
                        </div>
                    </div>

                    <Popover.Arrow className="fill-border" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}