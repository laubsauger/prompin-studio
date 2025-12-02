import React, { useState } from 'react';
import { useStore } from '../store';
import { Select } from './ui/select';
import { STATUS_OPTIONS } from '../config/constants';
import { Filter, Heart, ArrowUpDown, LayoutGrid, List } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Slider } from './ui/slider';

interface FilterBarProps {
    thumbnailSize: number;
    onThumbnailSizeChange: (size: number) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ thumbnailSize, onThumbnailSizeChange }) => {
    const { filter, setFilter, sortConfig, setSortConfig, filterConfig, setFilterConfig, viewMode, setViewMode } = useStore();

    return (
        <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 border-r border-border pr-2 mr-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterConfig({ likedOnly: !filterConfig.likedOnly })}
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
                    onChange={(e) => setFilterConfig({ type: e.target.value as any })}
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
                    onChange={(e) => setSortConfig(e.target.value as any, sortConfig.direction)}
                    className="w-[130px] h-8 text-xs"
                >
                    <option value="createdAt">Date Created</option>
                    <option value="updatedAt">Date Modified</option>
                    <option value="path">File Name</option>
                </Select>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortConfig(sortConfig.key, sortConfig.direction === 'asc' ? 'desc' : 'asc')}
                    className="h-8 w-8 p-0"
                    title={sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}
                >
                    <ArrowUpDown className={cn("h-4 w-4 transition-transform", sortConfig.direction === 'desc' && "rotate-180")} />
                </Button>
            </div>

            <div className="flex items-center gap-2 border-r border-border pr-2 mr-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
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
                        onClick={() => setViewMode('grid')}
                        className="h-7 px-2 rounded-r-none"
                        title="Grid View"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
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
