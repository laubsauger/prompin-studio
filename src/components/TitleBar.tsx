import React, { useState, useEffect } from 'react';
import { FolderOpen, Settings, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { Button } from './ui/button';

import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';
import { SyncStatus } from './SyncStatus';
import { Logo } from './Logo';
import { SearchPalette } from './SearchPalette';
import { PathDisplay } from './PathDisplay';

export const TitleBar: React.FC = () => {
    const { setRootPath, syncStats, fetchSyncStats, triggerResync, currentPath } = useStore();
    const { setSettingsOpen, rootFolder } = useSettingsStore();
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        fetchSyncStats();
        const interval = setInterval(fetchSyncStats, 1000); // Poll every second for responsive updates
        return () => clearInterval(interval);
    }, [fetchSyncStats]);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isSyncing = syncStats?.status !== 'idle';
    const isIndexing = syncStats?.status === 'indexing';
    const hasBackgroundTask = !!syncStats?.backgroundTask;
    const isActive = isSyncing || isIndexing || hasBackgroundTask;

    // Calculate progress based on current activity
    let progress = 0;
    if (syncStats) {
        if (hasBackgroundTask && syncStats.backgroundTask?.progress) {
            progress = syncStats.backgroundTask.progress;
        } else if (isIndexing && syncStats.embeddingProgress) {
            progress = (syncStats.embeddingProgress.current / syncStats.embeddingProgress.total) * 100;
        } else if (syncStats.totalFiles > 0) {
            progress = (syncStats.processedFiles / syncStats.totalFiles) * 100;
        }
    }

    const hasErrors = syncStats?.errors && syncStats.errors.length > 0;
    const hasThumbnailFailures = (syncStats?.thumbnailsFailed || 0) > 0;
    const hasIssues = hasErrors || hasThumbnailFailures;

    // Responsive breakpoints
    const showAppTitle = windowWidth > 500;
    const showItemCount = windowWidth > 700;
    const showFullPath = windowWidth > 600;

    return (
        <div className="h-10 bg-background border-b border-border flex items-center justify-between px-4 pl-20 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-0 overflow-hidden">
                <Logo className="w-4 h-4 shrink-0" />
                {showAppTitle && (
                    <span className="text-foreground whitespace-nowrap shrink-0">Prompin' Studio</span>
                )}
                {rootFolder && (
                    <>
                        <div className="h-4 w-[1px] bg-border shrink-0 mx-2" />
                        {showFullPath ? (
                            <PathDisplay
                                rootFolder={rootFolder}
                                currentPath={currentPath}
                                className="min-w-0"
                            />
                        ) : (
                            <span className="text-xs opacity-70 truncate" title={`${rootFolder}${currentPath ? '/' + currentPath : ''}`}>
                                {currentPath ? currentPath.split('/').pop() : rootFolder.split('/').pop()}
                            </span>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center gap-4 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {syncStats && (
                    <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground cursor-help">
                                <div className="flex items-center gap-2 shrink-0">
                                    {isActive ? (
                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                    ) : hasIssues ? (
                                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                                    ) : (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    )}
                                    <span className="whitespace-nowrap">
                                        {hasBackgroundTask && syncStats.backgroundTask ?
                                            syncStats.backgroundTask.name :
                                            isIndexing ? 'Indexing...' :
                                            isSyncing ? 'Syncing...' :
                                            'Ready'}
                                    </span>
                                </div>
                                {showItemCount && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="whitespace-nowrap">
                                            {isIndexing && syncStats.embeddingProgress ?
                                                `${syncStats.embeddingProgress.current} / ${syncStats.embeddingProgress.total}` :
                                                `${syncStats.processedFiles} / ${syncStats.totalFiles}`}
                                        </span>
                                        {isActive && (
                                            <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full transition-all duration-300",
                                                        isIndexing ? "bg-purple-500" :
                                                        hasBackgroundTask ? "bg-blue-500" :
                                                        "bg-primary"
                                                    )}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerResync();
                                    }}
                                    disabled={isActive}
                                    title="Resync"
                                >
                                    <RefreshCw className={cn("h-3 w-3", isActive && "animate-spin")} />
                                </Button>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 p-0" align="end">
                            <SyncStatus />
                        </HoverCardContent>
                    </HoverCard>
                )}

                <div className="h-4 w-[1px] bg-border" />

                <SearchPalette />

                <div className="h-4 w-px bg-border" />

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRootPath()}
                        title="Change Folder"
                    >
                        <FolderOpen className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setSettingsOpen(true)}
                        title="Settings"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
