import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';

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

    return (
        <>
            <div className="h-8 border-t border-border bg-card flex items-center px-4 text-xs text-muted-foreground justify-between select-none">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                    >
                        {isSyncing ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        ) : hasErrors || hasThumbnailFailures ? (
                            <AlertCircle className="h-3 w-3 text-yellow-500" />
                        ) : (
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                        )}
                        <span className="font-medium">
                            {isSyncing ? 'Syncing...' : 'Ready'}
                        </span>
                    </button>

                    <div className="h-3 w-[1px] bg-border" />

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                        <span>{syncStats.processedFiles} / {syncStats.totalFiles} items</span>
                        {syncStats.thumbnailsGenerated !== undefined && (
                            <>
                                <div className="h-3 w-[1px] bg-border" />
                                <span className="text-[10px]">
                                    {syncStats.thumbnailsGenerated} thumbnails
                                </span>
                            </>
                        )}
                        {isSyncing && (
                            <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </button>
                </div>

                <button
                    onClick={triggerResync}
                    disabled={isSyncing}
                    className={cn(
                        "flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        isSyncing && "animate-pulse"
                    )}
                >
                    <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                    Resync
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
