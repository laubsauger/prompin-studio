import React from 'react';
import { Badge } from './ui/badge';
import { ASSET_STATUSES } from '../config/constants';
import { cn } from '../lib/utils';
import type { AssetStatus } from '../types';

interface AssetStatusBadgeProps {
    status: AssetStatus;
    className?: string;
}

export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({ status, className }) => {
    const statusConfig = ASSET_STATUSES[status] || ASSET_STATUSES.unsorted;
    const colorName = statusConfig.color.match(/bg-(\w+)-/)?.[1] || 'gray';

    const getBadgeColors = (color: string) => {
        const colorMap: Record<string, string> = {
            'gray': 'border-gray-400 text-gray-300 bg-gray-900/40',
            'yellow': 'border-yellow-400 text-yellow-300 bg-yellow-900/40',
            'orange': 'border-orange-400 text-orange-300 bg-orange-900/40',
            'green': 'border-green-400 text-green-300 bg-green-900/40',
            'slate': 'border-slate-400 text-slate-300 bg-slate-900/40',
            'red': 'border-red-400 text-red-300 bg-red-900/40',
        };
        return colorMap[color] || colorMap.gray;
    };

    return (
        <Badge
            variant="outline"
            className={cn(
                "text-[9px] h-4 px-1 shadow-sm backdrop-blur-sm font-medium",
                getBadgeColors(colorName),
                className
            )}
        >
            {statusConfig.label}
        </Badge>
    );
};
