import React, { useEffect } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';

import { Loader2, RefreshCw } from 'lucide-react';

export const SyncStatus: React.FC = () => {
    const { syncStats, fetchSyncStats, triggerResync } = useStore();

    useEffect(() => {
        fetchSyncStats();
        const interval = setInterval(fetchSyncStats, 1000); // Poll every second
        return () => clearInterval(interval);
    }, [fetchSyncStats]);

    if (!syncStats) return null;

    const isSyncing = syncStats.status !== 'idle';
    const progress = syncStats.totalFiles > 0 ? (syncStats.processedFiles / syncStats.totalFiles) * 100 : 0;

    return (
        <div className="h-8 border-t border-border bg-card flex items-center px-4 text-xs text-muted-foreground justify-between select-none">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    {isSyncing ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                    <span className="font-medium">
                        {isSyncing ? 'Syncing...' : 'Ready'}
                    </span>
                </div>

                <div className="h-3 w-[1px] bg-border" />

                <div className="flex items-center gap-2">
                    <span>{syncStats.processedFiles} / {syncStats.totalFiles} items</span>
                    {isSyncing && (
                        <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>
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
    );
};
