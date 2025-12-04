import React from 'react';
import { useStore, type FilterConfig } from '../store';
import { SelectWithIcon } from './ui/select-with-icon';
import { ArrowUpDown, LayoutGrid, List, ArrowUp, ArrowDown, X, RotateCcw, Eye, EyeOff, Square, RectangleHorizontal, RectangleVertical, FileType, Heart } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { AdvancedFilters } from './AdvancedFilters';
import { StatusMultiSelect } from './StatusMultiSelect';
import { TagsMultiSelect } from './TagsMultiSelect';
import type { AssetStatus } from '../types';

export interface FilterBarUIProps {
    thumbnailSize: number;
    onThumbnailSizeChange: (size: number) => void;
    filter: AssetStatus | 'all';
    sortConfig: { key: 'createdAt' | 'updatedAt' | 'path'; direction: 'asc' | 'desc' };
    onSortConfigChange: (key: 'createdAt' | 'updatedAt' | 'path', direction: 'asc' | 'desc') => void;
    filterConfig: FilterConfig;
    onFilterConfigChange: (config: Partial<FilterConfig>) => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    aspectRatio: 'square' | 'video' | 'portrait';
    onAspectRatioChange: (ratio: 'square' | 'video' | 'portrait') => void;
    viewDisplay: 'clean' | 'detailed';

    onViewDisplayChange: (display: 'clean' | 'detailed') => void;
    onResetFilters: () => void;
}

export const FilterBarUI: React.FC<FilterBarUIProps> = ({
    thumbnailSize,
    onThumbnailSizeChange,
    filter,
    sortConfig,
    onSortConfigChange,
    filterConfig,
    onFilterConfigChange,
    viewMode,
    onViewModeChange,
    aspectRatio,
    onAspectRatioChange,
    viewDisplay,
    onViewDisplayChange,
    onResetFilters
}) => {
    // Check if any filters are active
    const hasActiveFilters = filterConfig.likedOnly ||
        (filterConfig.type && filterConfig.type !== 'all') ||
        (filterConfig.statuses && filterConfig.statuses.length > 0) ||
        (filterConfig.tagIds && filterConfig.tagIds.length > 0) ||
        filter !== 'all' ||
        filterConfig.tagId ||
        filterConfig.scratchPadId ||
        filterConfig.project ||
        filterConfig.scene ||
        filterConfig.shot ||
        filterConfig.platform ||
        filterConfig.model ||
        filterConfig.dateFrom ||
        filterConfig.dateTo ||
        filterConfig.relatedToAssetId;

    const clearAllFilters = () => {
        onResetFilters();
    };

    return (
        <div className="flex items-center gap-2 w-full">
            {/* Type filters with clear button */}
            <div className="flex items-center gap-1 ml-2">
                <SelectWithIcon
                    icon={<FileType className="h-3.5 w-3.5 text-muted-foreground" />}
                    value={filterConfig.type || 'all'}
                    onChange={(e) => onFilterConfigChange({ type: e.target.value as 'all' | 'image' | 'video' })}
                    className="w-[110px] h-8 text-xs"
                >
                    <option value="all">Media</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                </SelectWithIcon>
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

            {/* Liked Only Filter */}
            <Button
                variant={filterConfig.likedOnly ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onFilterConfigChange({ likedOnly: !filterConfig.likedOnly })}
                className={cn("h-8 w-8 p-0 ml-1", filterConfig.likedOnly && "bg-red-500 hover:bg-red-600 text-white")}
                title={filterConfig.likedOnly ? "Show all" : "Show liked only"}
            >
                <Heart className={cn("h-4 w-4", filterConfig.likedOnly && "fill-current")} />
            </Button>

            {/* Status filter with multi-select */}
            <StatusMultiSelect
                selectedStatuses={filterConfig.statuses || []}
                onStatusChange={(statuses) => onFilterConfigChange({ statuses })}
            />

            {/* Tags filter with multi-select */}
            <TagsMultiSelect
                selectedTagIds={filterConfig.tagIds || []}
                onTagsChange={(tagIds) => onFilterConfigChange({ tagIds })}
            />

            <div className="flex items-center gap-1 pr-2">
                <SelectWithIcon
                    icon={<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    value={sortConfig.key}
                    onChange={(e) => onSortConfigChange(e.target.value as 'createdAt' | 'updatedAt' | 'path', sortConfig.direction)}
                    className="w-[140px] h-8 text-xs"
                >
                    <option value="createdAt">Date Created</option>
                    <option value="updatedAt">Date Modified</option>
                    <option value="path">File Name</option>
                </SelectWithIcon>
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
                <div className="border-r border-border h-8"></div>

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
                        {/* Clean/Detailed View Toggle */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDisplayChange(viewDisplay === 'clean' ? 'detailed' : 'clean')}
                            className={cn("h-7 w-7 p-0", viewDisplay === 'detailed' && "text-primary bg-accent")}
                            title={viewDisplay === 'clean' ? "Show details" : "Hide details"}
                        >
                            {viewDisplay === 'clean' ? (
                                <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                                <Eye className="h-3.5 w-3.5" />
                            )}
                        </Button>

                        <div className="flex items-center gap-2 mr-2">
                            {/* Aspect Ratio Toggle */}
                            <div className="flex items-center border rounded-md">
                                <Button
                                    variant={aspectRatio === 'square' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => onAspectRatioChange('square')}
                                    className="h-7 px-2 rounded-r-none"
                                    title="Square"
                                >
                                    <Square className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant={aspectRatio === 'video' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => onAspectRatioChange('video')}
                                    className="h-7 px-2 border-x rounded-none"
                                    title="Landscape"
                                >
                                    <RectangleHorizontal className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant={aspectRatio === 'portrait' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => onAspectRatioChange('portrait')}
                                    className="h-7 px-2 rounded-l-none"
                                    title="Portrait"
                                >
                                    <RectangleVertical className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            <Slider
                                value={[thumbnailSize]}
                                onValueChange={(value) => onThumbnailSizeChange(value[0])}
                                min={100}
                                max={800}
                                step={50}
                                className="w-24"
                            />
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
    const resetFilters = useStore(state => state.resetFilters);

    return (
        <FilterBarUI
            thumbnailSize={thumbnailSize}
            onThumbnailSizeChange={onThumbnailSizeChange}
            filter={filter}
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
            onResetFilters={resetFilters}
        />
    );
};
