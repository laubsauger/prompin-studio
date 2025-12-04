import React, { useState } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SyncStatusModal } from './SyncStatusModal';

export const SyncStatus: React.FC = () => {
    const syncStats = useStore(state => state.syncStats);
    const triggerResync = useStore(state => state.triggerResync);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const isSyncing = syncStats?.status !== 'idle';

    // Polling is handled by TitleBar (parent) to avoid duplicate requests
    // We just read the store state here

    if (!syncStats) return null;
    const progress = syncStats.totalFiles > 0 ? (syncStats.processedFiles / syncStats.totalFiles) * 100 : 0;
    const hasErrors = syncStats.errors && syncStats.errors.length > 0;
    const hasThumbnailFailures = (syncStats.thumbnailsFailed || 0) > 0;

    return (
        <>
            <div className="p-4 bg-card space-y-4 min-w-[320px]">
                {/* Status Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {isSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : hasErrors || hasThumbnailFailures ? (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">
                                {isSyncing ? 'Syncing...' : 'Ready'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {syncStats.lastSync ? formatDistanceToNow(new Date(syncStats.lastSync), { addSuffix: true }) : 'Never synced'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={triggerResync}
                        disabled={isSyncing}
                        className={cn(
                            "p-1.5 rounded-md hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            isSyncing && "animate-pulse"
                        )}
                        title="Resync Library"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                    </button>
                </div>

                {/* Progress Bar (when syncing) */}
                {isSyncing && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                            <span>Processing files...</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-secondary/30 rounded border border-border/50 flex flex-col items-center">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
                        <span className="text-sm font-bold tabular-nums">{syncStats.totalFiles}</span>
                    </div>
                    <div className="p-2 bg-secondary/30 rounded border border-border/50 flex flex-col items-center">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Processed</span>
                        <span className="text-sm font-bold tabular-nums">{syncStats.processedFiles}</span>
                    </div>
                </div>

                {/* Errors/Warnings */}
                {(hasErrors || hasThumbnailFailures) && (
                    <div className="p-2 rounded bg-red-500/10 border border-red-500/20 space-y-1">
                        {hasErrors && (
                            <div className="flex items-center gap-2 text-xs text-red-500 font-medium">
                                <AlertCircle className="h-3 w-3" />
                                <span>{syncStats.errors!.length} sync errors</span>
                            </div>
                        )}
                        {hasThumbnailFailures && (
                            <div className="flex items-center gap-2 text-xs text-yellow-500 font-medium">
                                <AlertCircle className="h-3 w-3" />
                                <span>{syncStats.thumbnailsFailed} thumbnail failures</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Click for Details */}
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors flex items-center justify-center gap-1"
                >
                    View detailed status
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
