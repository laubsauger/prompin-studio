import React, { useState } from 'react';
import { Check, ChevronsUpDown, X, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from './ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import { Badge } from './ui/badge';
import { ASSET_STATUSES } from '../config/constants';
import type { AssetStatus } from '../types';

interface StatusMultiSelectProps {
    selectedStatuses: AssetStatus[];
    onStatusChange: (statuses: AssetStatus[]) => void;
    className?: string;
}

export function StatusMultiSelect({
    selectedStatuses,
    onStatusChange,
    className
}: StatusMultiSelectProps) {
    const [open, setOpen] = useState(false);

    const toggleStatus = (status: AssetStatus) => {
        if (selectedStatuses.includes(status)) {
            onStatusChange(selectedStatuses.filter(s => s !== status));
        } else {
            onStatusChange([...selectedStatuses, status]);
        }
    };

    const clearAll = () => {
        onStatusChange([]);
    };

    // Get color classes for status badges - matching AssetCard overlay style
    const getStatusColors = (status: AssetStatus) => {
        const colorName = ASSET_STATUSES[status].color.match(/bg-(\w+)-/)?.[1] || 'gray';
        const colorMap: Record<string, string> = {
            'gray': 'border-gray-400 text-gray-300 bg-gray-900/40',
            'yellow': 'border-yellow-400 text-yellow-300 bg-yellow-900/40',
            'orange': 'border-orange-400 text-orange-300 bg-orange-900/40',
            'green': 'border-green-400 text-green-300 bg-green-900/40',
            'slate': 'border-slate-400 text-slate-300 bg-slate-900/40',
            'red': 'border-red-400 text-red-300 bg-red-900/40',
        };
        return colorMap[colorName] || colorMap.gray;
    };

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "h-8 justify-between text-xs min-w-[150px]",
                            selectedStatuses.length > 0 && "bg-blue-500/10 border-blue-500/50"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <Filter className="h-3 w-3" />
                            {selectedStatuses.length === 0 ? (
                                "Status"
                            ) : selectedStatuses.length === 1 ? (
                                <>
                                    <div className={cn(
                                        "w-2 h-2 rounded-full border",
                                        getStatusColors(selectedStatuses[0])
                                    )} />
                                    {ASSET_STATUSES[selectedStatuses[0]].label}
                                </>
                            ) : (
                                `${selectedStatuses.length} statuses`
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search status..." className="h-8 text-xs" />
                        <CommandEmpty>No status found.</CommandEmpty>
                        <CommandGroup>
                            {Object.entries(ASSET_STATUSES).map(([value, config]) => {
                                const status = value as AssetStatus;
                                const isSelected = selectedStatuses.includes(status);
                                return (
                                    <CommandItem
                                        key={status}
                                        value={config.label}
                                        onSelect={() => toggleStatus(status)}
                                        className="text-xs"
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-3 w-3")} />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full border",
                                                getStatusColors(status)
                                            )} />
                                            {config.label}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedStatuses.length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="h-8 w-6 p-0"
                    title="Clear status filter"
                >
                    <X className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}