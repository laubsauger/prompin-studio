import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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

interface StatusSelectorProps {
    currentStatus: AssetStatus;
    onStatusChange: (status: AssetStatus) => void;
    className?: string;
    compact?: boolean;
}

export function StatusSelector({
    currentStatus,
    onStatusChange,
    className,
    compact = false
}: StatusSelectorProps) {
    const [open, setOpen] = useState(false);

    // Get color classes for status badges
    const getStatusColors = (status: AssetStatus) => {
        const colorName = ASSET_STATUSES[status].color.match(/bg-(\w+)-/)?.[1] || 'gray';
        const colorMap: Record<string, string> = {
            'gray': 'border-gray-400 text-gray-600 bg-gray-50',
            'yellow': 'border-yellow-400 text-yellow-700 bg-yellow-50',
            'orange': 'border-orange-400 text-orange-700 bg-orange-50',
            'green': 'border-green-400 text-green-700 bg-green-50',
            'slate': 'border-slate-400 text-slate-700 bg-slate-50',
            'red': 'border-red-400 text-red-700 bg-red-50',
        };
        return colorMap[colorName] || colorMap.gray;
    };

    const handleStatusSelect = (status: AssetStatus) => {
        onStatusChange(status);
        setOpen(false);
    };

    const currentConfig = ASSET_STATUSES[currentStatus];

    if (compact) {
        // Compact mode - just shows badge that's clickable
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn("h-auto p-0 hover:bg-transparent", className)}
                    >
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] h-5 px-1.5 font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                getStatusColors(currentStatus)
                            )}
                        >
                            {currentConfig.label}
                            <ChevronsUpDown className="ml-1 h-2 w-2 opacity-50" />
                        </Badge>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search status..." className="h-8 text-xs" />
                        <CommandEmpty>No status found.</CommandEmpty>
                        <CommandGroup>
                            {Object.entries(ASSET_STATUSES).map(([value, config]) => {
                                const status = value as AssetStatus;
                                const isSelected = status === currentStatus;
                                return (
                                    <CommandItem
                                        key={status}
                                        value={config.label}
                                        onSelect={() => handleStatusSelect(status)}
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
        );
    }

    // Full mode with button
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("h-8 justify-between text-xs", className)}
                >
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-2 h-2 rounded-full border",
                            getStatusColors(currentStatus)
                        )} />
                        {currentConfig.label}
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
                            const isSelected = status === currentStatus;
                            return (
                                <CommandItem
                                    key={status}
                                    value={config.label}
                                    onSelect={() => handleStatusSelect(status)}
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
    );
}