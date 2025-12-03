import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import type { SyncStats } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2, Film, Image, FileQuestion } from 'lucide-react';
import { cn } from '../lib/utils';

interface SyncStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    syncStats: SyncStats | null;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({ isOpen, onClose, syncStats }) => {
    if (!syncStats) return null;

    const hasErrors = syncStats.errors && syncStats.errors.length > 0;
    const hasThumbnailFailures = (syncStats.thumbnailsFailed || 0) > 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sync Status Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Overview */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                            <div className="text-sm text-muted-foreground mb-1">Status</div>
                            <div className="text-lg font-semibold capitalize flex items-center gap-2">
                                {syncStats.status === 'idle' ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                )}
                                {syncStats.status}
                            </div>
                            {syncStats.currentFile && (
                                <div className="text-xs text-muted-foreground mt-2 truncate" title={syncStats.currentFile}>
                                    {syncStats.currentFile}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                            <div className="text-sm text-muted-foreground mb-1">Last Sync</div>
                            <div className="text-lg font-semibold">
                                {syncStats.lastSync ? formatDistanceToNow(new Date(syncStats.lastSync), { addSuffix: true }) : 'Never'}
                            </div>
                        </div>

                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                            <div className="text-sm text-muted-foreground mb-1">Total Files</div>
                            <div className="text-lg font-semibold">{syncStats.totalFiles}</div>
                            {syncStats.skippedFiles !== undefined && syncStats.skippedFiles > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    ({syncStats.skippedFiles} skipped)
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                            <div className="text-sm text-muted-foreground mb-1">Processed</div>
                            <div className="text-lg font-semibold">{syncStats.processedFiles}</div>
                            <div className="w-full bg-secondary h-1.5 mt-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-300"
                                    style={{ width: `${syncStats.totalFiles > 0 ? (syncStats.processedFiles / syncStats.totalFiles) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* File Types Breakdown */}
                    {syncStats.filesByType && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                            <div className="text-sm font-medium mb-3">Files by Type</div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="flex items-center gap-2">
                                    <Image className="h-4 w-4 text-blue-500" />
                                    <div>
                                        <div className="text-xs text-muted-foreground">Images</div>
                                        <div className="text-lg font-semibold">{syncStats.filesByType.images}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Film className="h-4 w-4 text-purple-500" />
                                    <div>
                                        <div className="text-xs text-muted-foreground">Videos</div>
                                        <div className="text-lg font-semibold">{syncStats.filesByType.videos}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <FileQuestion className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <div className="text-xs text-muted-foreground">Other</div>
                                        <div className="text-lg font-semibold">{syncStats.filesByType.other}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Thumbnails */}
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="text-sm font-medium mb-3">Thumbnails</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">Generated</div>
                                <div className={cn(
                                    "text-lg font-semibold",
                                    (syncStats.thumbnailsGenerated || 0) > 0 && "text-green-500"
                                )}>
                                    {syncStats.thumbnailsGenerated || 0}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">Failed</div>
                                <div className={cn(
                                    "text-lg font-semibold",
                                    hasThumbnailFailures && "text-red-500"
                                )}>
                                    {syncStats.thumbnailsFailed || 0}
                                </div>
                            </div>
                        </div>
                        {syncStats.thumbnailProgress && syncStats.thumbnailProgress.total > 0 && (
                            <div className="mt-3">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Generating...</span>
                                    <span>{Math.round((syncStats.thumbnailProgress.current / syncStats.thumbnailProgress.total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-primary h-full transition-all duration-300"
                                        style={{ width: `${(syncStats.thumbnailProgress.current / syncStats.thumbnailProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Errors */}
                    {hasErrors && (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <div className="text-sm font-medium text-red-500">
                                    Errors ({syncStats.errors!.length})
                                </div>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {syncStats.errors!.slice(0, 20).map((error, idx) => (
                                    <div key={idx} className="p-2 rounded bg-background/50 border border-border">
                                        <div className="text-xs font-mono text-muted-foreground truncate mb-1">
                                            {error.file}
                                        </div>
                                        <div className="text-xs text-red-500">{error.error}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1">
                                            {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
                                        </div>
                                    </div>
                                ))}
                                {syncStats.errors!.length > 20 && (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                        ... and {syncStats.errors!.length - 20} more errors
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* All Clear Message */}
                    {!hasErrors && !hasThumbnailFailures && syncStats.status === 'idle' && (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <div className="text-sm text-green-500">
                                All files synced successfully with no errors
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
