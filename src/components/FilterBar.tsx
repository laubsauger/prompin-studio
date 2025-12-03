import React from 'react';
import { useStore } from '../store';
import { Select } from './ui/select';
import { STATUS_OPTIONS } from '../config/constants';
import { Filter, Heart, ArrowUpDown, LayoutGrid, List, ArrowUp, ArrowDown, X, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Slider } from './ui/slider';
import { AdvancedFilters } from './AdvancedFilters';
import { StatusMultiSelect } from './StatusMultiSelect';
import type { AssetStatus } from '../types';

export interface FilterBarUIProps {
    thumbnailSize: number;
    onThumbnailSizeChange: (size: number) => void;
    filter: AssetStatus | 'all';
    onFilterChange: (filter: AssetStatus | 'all') => void;
    sortConfig: { key: 'createdAt' | 'updatedAt' | 'path'; direction: 'asc' | 'desc' };
    onSortConfigChange: (key: 'createdAt' | 'updatedAt' | 'path', direction: 'asc' | 'desc') => void;
    filterConfig: { likedOnly: boolean; type: 'all' | 'image' | 'video'; tagId?: string | null; status?: AssetStatus | 'all'; statuses?: AssetStatus[] };
    onFilterConfigChange: (config: Partial<{ likedOnly: boolean; type: 'all' | 'image' | 'video'; tagId?: string | null; status?: AssetStatus | 'all'; statuses?: AssetStatus[] }>) => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    aspectRatio: 'square' | 'video' | 'portrait';
    onAspectRatioChange: (ratio: 'square' | 'video' | 'portrait') => void;
    viewDisplay: 'clean' | 'detailed';
    onViewDisplayChange: (display: 'clean' | 'detailed') => void;
}

export const FilterBarUI: React.FC<FilterBarUIProps> = ({
    thumbnailSize,
    onThumbnailSizeChange,
    filter,
    onFilterChange,
    sortConfig,
    onSortConfigChange,
    filterConfig,
    onFilterConfigChange,
    viewMode,
    onViewModeChange,
    aspectRatio,
    onAspectRatioChange,
    viewDisplay,
    onViewDisplayChange
}) => {
    // Check if any filters are active
    const hasActiveFilters = filterConfig.likedOnly ||
        (filterConfig.type && filterConfig.type !== 'all') ||
        (filterConfig.statuses && filterConfig.statuses.length > 0) ||
        filter !== 'all';

    const clearAllFilters = () => {
        onFilterConfigChange({ likedOnly: false, type: 'all', tagId: null, status: 'all', statuses: [] });
        onFilterChange('all');
    };

    return (
        <div className="flex items-center gap-2 w-full">
            {/* Like button - separate from type filters */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onFilterConfigChange({ likedOnly: !filterConfig.likedOnly })}
                className={cn(
                    "h-8 w-8 p-0",
                    filterConfig.likedOnly && "text-red-500 hover:text-red-600"
                )}
                title="Show Liked Only"
            >
                <Heart className={cn("h-4 w-4", filterConfig.likedOnly && "fill-current")} />
            </Button>

            {/* Separator between like and type filters */}
            <div className="w-px h-6 bg-border" />

            {/* Type filters with clear button */}
            <div className="flex items-center gap-1">
                <Select
                    value={filterConfig.type || 'all'}
                    onChange={(e) => onFilterConfigChange({ type: e.target.value as any })}
                    className="w-[100px] h-8 text-xs"
                >
                    <option value="all">All Types</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                </Select>
                {filterConfig.type && filterConfig.type !== 'all' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onFilterConfigChange({ type: 'all' })}
                        className="h-8 w-6 p-0"
                        title="Clear type filter"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2 border-r border-border pr-2 mr-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select
                    value={sortConfig.key}
                    onChange={(e) => onSortConfigChange(e.target.value as any, sortConfig.direction)}
                    className="w-[130px] h-8 text-xs"
                >
                    <option value="createdAt">Date Created</option>
                    <option value="updatedAt">Date Modified</option>
                    <option value="path">File Name</option>
                </Select>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSortConfigChange(sortConfig.key, sortConfig.direction === 'asc' ? 'desc' : 'asc')}
                    className="h-8 w-8 p-0"
                    title={sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}
                >
                    {sortConfig.direction === 'asc' ? (
                        <ArrowUp className="h-4 w-4" />
                    ) : (
                        <ArrowDown className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Status filter with multi-select */}
            <div className="flex items-center gap-1 border-r border-border pr-2 mr-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <StatusMultiSelect
                    selectedStatuses={filterConfig.statuses || []}
                    onStatusChange={(statuses) => onFilterConfigChange({ statuses })}
                />
            </div>

            {/* Advanced Filters */}
            <AdvancedFilters />

            {/* Clear All Filters button - shown when any filter is active */}
            {hasActiveFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    title="Clear all filters"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="text-xs">Clear All</span>
                </Button>
            )}

            {/* View Mode Switcher & Thumbnail Size */}
            <div className="flex items-center gap-2 ml-auto">
                {viewMode === 'grid' && (
                    <>
                        <div className="flex items-center gap-2 mr-2">
                            <Select
                                value={aspectRatio}
                                onChange={(e) => onAspectRatioChange(e.target.value as any)}
                                className="w-[100px] h-8 text-xs"
                            >
                                <option value="square">Square</option>
                                <option value="video">Landscape</option>
                                <option value="portrait">Portrait</option>
                            </Select>
                            <Slider
                                value={[thumbnailSize]}
                                onValueChange={(value) => onThumbnailSizeChange(value[0])}
                                min={150}
                                max={400}
                                step={50}
                                className="w-24"
                            />
                        </div>

                        {/* Clean/Detailed View Toggle */}
                        <div className="flex items-center border rounded-md">
                            <Button
                                variant={viewDisplay === 'clean' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => onViewDisplayChange('clean')}
                                className="h-7 px-2 rounded-r-none"
                                title="Clean View - Focus on images"
                            >
                                <EyeOff className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant={viewDisplay === 'detailed' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => onViewDisplayChange('detailed')}
                                className="h-7 px-2 rounded-l-none border-l"
                                title="Detailed View - Show status and tags"
                            >
                                <Eye className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </>
                )}

                <div className="flex items-center border rounded-md">
                    <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('grid')}
                        className="h-7 px-2 rounded-r-none"
                        title="Grid View"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('list')}
                        className="h-7 px-2 rounded-l-none border-l"
                        title="List View"
                    >
                        <List className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

interface FilterBarProps {
    thumbnailSize: number;
    onThumbnailSizeChange: (size: number) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ thumbnailSize, onThumbnailSizeChange }) => {
    const filter = useStore(state => state.filter);
    const setFilter = useStore(state => state.setFilter);
    const sortConfig = useStore(state => state.sortConfig);
    const setSortConfig = useStore(state => state.setSortConfig);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);
    const viewMode = useStore(state => state.viewMode);
    const setViewMode = useStore(state => state.setViewMode);
    const aspectRatio = useStore(state => state.aspectRatio);
    const setAspectRatio = useStore(state => state.setAspectRatio);
    const viewDisplay = useStore(state => state.viewDisplay);
    const setViewDisplay = useStore(state => state.setViewDisplay);

    return (
        <FilterBarUI
            thumbnailSize={thumbnailSize}
            onThumbnailSizeChange={onThumbnailSizeChange}
            filter={filter}
            onFilterChange={setFilter}
            sortConfig={sortConfig}
            onSortConfigChange={setSortConfig}
            filterConfig={filterConfig}
            onFilterConfigChange={setFilterConfig}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            viewDisplay={viewDisplay}
            onViewDisplayChange={setViewDisplay}
        />
    );
};
