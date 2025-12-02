import React from 'react';
import { useStore } from '../store';
import { Select } from './ui/select';
import { STATUS_OPTIONS } from '../config/constants';
import { Filter, Heart, ArrowUpDown, LayoutGrid, List, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Slider } from './ui/slider';
import type { AssetStatus } from '../types';

export interface FilterBarUIProps {
    thumbnailSize: number;
    onThumbnailSizeChange: (size: number) => void;
    filter: AssetStatus | 'all';
    onFilterChange: (filter: AssetStatus | 'all') => void;
    sortConfig: { key: 'createdAt' | 'updatedAt' | 'path'; direction: 'asc' | 'desc' };
    onSortConfigChange: (key: 'createdAt' | 'updatedAt' | 'path', direction: 'asc' | 'desc') => void;
    filterConfig: { likedOnly: boolean; type: 'all' | 'image' | 'video'; tagId?: string | null; status?: AssetStatus | 'all' };
    onFilterConfigChange: (config: Partial<{ likedOnly: boolean; type: 'all' | 'image' | 'video'; tagId?: string | null; status?: AssetStatus | 'all' }>) => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
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
    onViewModeChange
}) => {
    return (
        <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 border-r border-border pr-2 mr-2">
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

                <Select
                    value={filterConfig.type || 'all'}
                    onChange={(e) => onFilterConfigChange({ type: e.target.value as any })}
                    className="w-[100px] h-8 text-xs"
                >
                    <option value="all">All Types</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                </Select>
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

            <div className="flex items-center gap-2 border-r border-border pr-2 mr-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                    value={filter}
                    onChange={(e) => onFilterChange(e.target.value as any)}
                    className="w-[150px] h-8 text-xs"
                >
                    <option value="all">All Statuses</option>
                    {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Select>
            </div>

            {/* View Mode Switcher & Thumbnail Size */}
            <div className="flex items-center gap-2 ml-auto">
                {viewMode === 'grid' && (
                    <div className="flex items-center gap-2 mr-2">
                        <Slider
                            value={[thumbnailSize]}
                            onValueChange={(value) => onThumbnailSizeChange(value[0])}
                            min={150}
                            max={400}
                            step={50}
                            className="w-24"
                        />
                    </div>
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
        />
    );
};
