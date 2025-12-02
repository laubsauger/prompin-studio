import React from 'react';
import { useStore } from '../store';
import { Select } from './ui/select';
import { STATUS_OPTIONS } from '../config/constants';
import { Filter, Heart, ArrowUpDown } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export const FilterBar: React.FC = () => {
    const { filter, setFilter, sortConfig, setSortConfig, filterConfig, setFilterConfig } = useStore();

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-r border-border pr-2 mr-2">
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
                    <span className="text-xs font-bold">{sortConfig.direction === 'asc' ? 'ASC' : 'DESC'}</span>
                </Button>
            </div>

            <div className="flex items-center gap-2">
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
        </div>
    );
};
