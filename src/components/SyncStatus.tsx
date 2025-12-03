import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { SyncStatusModal } from './SyncStatusModal';

export const SyncStatus: React.FC = () => {
    const syncStats = useStore(state => state.syncStats);
    const fetchSyncStats = useStore(state => state.fetchSyncStats);
    const triggerResync = useStore(state => state.triggerResync);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const isSyncing = syncStats?.status !== 'idle';

    useEffect(() => {
        // Initial fetch
        fetchSyncStats();

        // Only poll when actively syncing, and at a slower rate
        if (isSyncing) {
            const interval = setInterval(fetchSyncStats, 2000); // Poll every 2 seconds when syncing
            return () => clearInterval(interval);
        } else {
            // When idle, poll much less frequently to catch new changes
            const interval = setInterval(fetchSyncStats, 10000); // Poll every 10 seconds when idle
            return () => clearInterval(interval);
        }
    }, [fetchSyncStats, isSyncing]);

    if (!syncStats) return null;
    const progress = syncStats.totalFiles > 0 ? (syncStats.processedFiles / syncStats.totalFiles) * 100 : 0;
    const hasErrors = syncStats.errors && syncStats.errors.length > 0;
    const hasThumbnailFailures = (syncStats.thumbnailsFailed || 0) > 0;

    const imageCount = syncStats.filesByType?.images || 0;
    const videoCount = syncStats.filesByType?.videos || 0;
    const folderCount = syncStats.folderCount || 0;

    return (
        <>
            <div className="p-3 bg-card space-y-3 min-w-[280px]">
                {/* Status Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : hasErrors || hasThumbnailFailures ? (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                        ) : (
                            <div className="h-3 w-3 rounded-full bg-green-500" />
                        )}
                        <span className="font-medium text-sm">
                            {isSyncing ? 'Syncing...' : 'Ready'}
                        </span>
                    </div>
                    <button
                        onClick={triggerResync}
                        disabled={isSyncing}
                        className={cn(
                            "flex items-center gap-1.5 text-xs hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            isSyncing && "animate-pulse"
                        )}
                    >
                        <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                        Resync
                    </button>
                </div>

                {/* Progress Bar (when syncing) */}
                {isSyncing && (
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Files:</span>
                        <span className="font-medium tabular-nums">{syncStats.totalFiles}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Processed:</span>
                        <span className="font-medium tabular-nums">{syncStats.processedFiles}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Images:</span>
                        <span className="font-medium tabular-nums">{imageCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Videos:</span>
                        <span className="font-medium tabular-nums">{videoCount}</span>
                    </div>
                    {folderCount > 0 && (
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Folders:</span>
                            <span className="font-medium tabular-nums">{folderCount}</span>
                        </div>
                    )}
                    {syncStats.thumbnailsGenerated !== undefined && (
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Thumbnails:</span>
                            <span className="font-medium tabular-nums">{syncStats.thumbnailsGenerated}</span>
                        </div>
                    )}
                </div>

                {/* Errors/Warnings */}
                {(hasErrors || hasThumbnailFailures) && (
                    <div className="pt-2 border-t border-border">
                        {hasErrors && (
                            <div className="flex items-center gap-2 text-xs text-yellow-500">
                                <AlertCircle className="h-3 w-3" />
                                <span>{syncStats.errors!.length} sync errors</span>
                            </div>
                        )}
                        {hasThumbnailFailures && (
                            <div className="flex items-center gap-2 text-xs text-yellow-500">
                                <AlertCircle className="h-3 w-3" />
                                <span>{syncStats.thumbnailsFailed} thumbnail failures</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Last Sync Time */}
                {syncStats.lastSync && (
                    <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                        Last sync: {formatDistanceToNow(new Date(syncStats.lastSync), { addSuffix: true })}
                    </div>
                )}

                {/* Click for Details */}
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full pt-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    Click for detailed sync status →
                </button>
            </div>

            <SyncStatusModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                syncStats={syncStats}
            />
        </>
    );
};
