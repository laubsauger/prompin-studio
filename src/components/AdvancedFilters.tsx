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
        if (key === 'semantic') return false; // Don't count semantic flag as separate filter
        // Handle empty arrays (statuses, tagIds)
        if (Array.isArray(value) && value.length === 0) return false;
        // Handle null, undefined, empty string
        if (value === null || value === undefined || value === '') return false;
        return true;
    }).length;

    // ... (lines 38-195)

    <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 hover:bg-purple-500/20"
        onClick={() => {
            const newConfig = { ...filterConfig, relatedToAssetId: undefined, semantic: false };
            setFilterConfig(newConfig);
            searchAssets(undefined, newConfig);
        }}
        title="Clear Context"
    >
        <X className="h-3 w-3" />
    </Button>
                                </div >
                            </div >
                        )
}

{/* Production Metadata */ }
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

{/* AI Model Metadata */ }
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

{/* Date Range */ }
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
                    </div >

    <Popover.Arrow className="fill-border" />
                </Popover.Content >
            </Popover.Portal >
        </Popover.Root >
    );
}