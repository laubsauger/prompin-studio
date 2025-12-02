import React, { useState } from 'react';
import { ChevronDown, Calendar, User, Film, Tag, Cpu } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Select } from './ui/select';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../lib/utils';
import type { AssetStatus } from '../types';

export function AdvancedFilters() {
    const [isOpen, setIsOpen] = useState(false);
    const { filterConfig, setFilterConfig, searchAssets, tags } = useStore();

    const handleFilterChange = (key: string, value: any) => {
        const newConfig = { ...filterConfig, [key]: value };
        setFilterConfig(newConfig);
        searchAssets(undefined, newConfig);
    };

    const clearFilters = () => {
        const clearedConfig = {
            likedOnly: false,
            type: 'all' as const,
            status: 'all' as AssetStatus | 'all',
            tagId: null,
            authorId: undefined,
            project: undefined,
            scene: undefined,
            shot: undefined,
            platform: undefined,
            model: undefined,
            dateFrom: undefined,
            dateTo: undefined
        };
        setFilterConfig(clearedConfig);
        searchAssets(undefined, clearedConfig);
    };

    const activeFilterCount = Object.entries(filterConfig).filter(([key, value]) => {
        if (key === 'type' && value === 'all') return false;
        if (key === 'status' && value === 'all') return false;
        if (key === 'likedOnly' && !value) return false;
        if (!value) return false;
        return true;
    }).length;

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-8 gap-2",
                        activeFilterCount > 0 && "bg-blue-500/10 border-blue-500/50"
                    )}
                >
                    <ChevronDown className="h-4 w-4" />
                    Advanced Filters
                    {activeFilterCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                            {activeFilterCount}
                        </span>
                    )}
                </Button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="z-50 w-96 rounded-lg bg-gray-900 border border-gray-700 shadow-xl"
                    sideOffset={5}
                >
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white">Advanced Filters</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="h-7 text-xs text-gray-400 hover:text-white"
                            >
                                Clear All
                            </Button>
                        </div>

                        {/* Production Metadata */}
                        <div className="space-y-3">
                            <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                                <Film className="h-3.5 w-3.5" />
                                Production
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder="Project"
                                    value={filterConfig.project || ''}
                                    onChange={(e) => handleFilterChange('project', e.target.value || undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Scene"
                                    value={filterConfig.scene || ''}
                                    onChange={(e) => handleFilterChange('scene', e.target.value || undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Shot"
                                    value={filterConfig.shot || ''}
                                    onChange={(e) => handleFilterChange('shot', e.target.value || undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Author ID"
                                    value={filterConfig.authorId || ''}
                                    onChange={(e) => handleFilterChange('authorId', e.target.value || undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* AI Model Metadata */}
                        <div className="space-y-3">
                            <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                                <Cpu className="h-3.5 w-3.5" />
                                AI Model
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder="Platform"
                                    value={filterConfig.platform || ''}
                                    onChange={(e) => handleFilterChange('platform', e.target.value || undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Model"
                                    value={filterConfig.model || ''}
                                    onChange={(e) => handleFilterChange('model', e.target.value || undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Tags */}
                        {tags.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                                    <Tag className="h-3.5 w-3.5" />
                                    Tags
                                </div>
                                <Select
                                    value={filterConfig.tagId || ''}
                                    onChange={(e) => handleFilterChange('tagId', e.target.value || null)}
                                    className="w-full h-8 text-xs"
                                >
                                    <option value="">All Tags</option>
                                    {tags.map(tag => (
                                        <option key={tag.id} value={tag.id}>
                                            {tag.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        {/* Date Range */}
                        <div className="space-y-3">
                            <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                Date Range
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    value={filterConfig.dateFrom ? new Date(filterConfig.dateFrom).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    type="date"
                                    value={filterConfig.dateTo ? new Date(filterConfig.dateTo).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                                    className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <Popover.Arrow className="fill-gray-700" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}