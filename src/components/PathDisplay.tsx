import React from 'react';
import { cn } from '../lib/utils';

interface PathDisplayProps {
    rootFolder: string | null;
    currentPath: string | null;
    className?: string;
}

export const PathDisplay: React.FC<PathDisplayProps> = ({ rootFolder, currentPath, className }) => {
    if (!rootFolder) return null;

    // Split paths into segments
    const rootSegments = rootFolder.split('/').filter(Boolean);
    const currentSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

    // Get last part of root folder (most important)
    const rootName = rootSegments[rootSegments.length - 1] || rootFolder;

    // Build display path - prioritize showing the end segments
    const getDisplayPath = () => {
        if (!currentPath) {
            return { root: rootName, current: null, truncated: false };
        }

        // If current path has segments, show them
        if (currentSegments.length === 1) {
            return { root: rootName, current: currentSegments[0], truncated: false };
        }

        if (currentSegments.length === 2) {
            return { root: rootName, current: currentSegments.join('/'), truncated: false };
        }

        // For longer paths, show last 2 segments with ellipsis
        if (currentSegments.length > 2) {
            const lastTwo = currentSegments.slice(-2).join('/');
            return { root: rootName, current: `.../${lastTwo}`, truncated: true };
        }

        return { root: rootName, current: currentPath, truncated: false };
    };

    const { root, current } = getDisplayPath();

    return (
        <div className={cn("flex items-center gap-1 text-xs overflow-hidden", className)}>
            <span className="opacity-70 truncate shrink-0 max-w-[150px]" title={rootFolder}>
                {root}
            </span>
            {current && (
                <>
                    <span className="opacity-50 shrink-0">/</span>
                    <span className="text-foreground truncate max-w-[200px]" title={currentPath || undefined}>
                        {current}
                    </span>
                </>
            )}
        </div>
    );
};