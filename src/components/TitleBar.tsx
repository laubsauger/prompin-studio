import React from 'react';
import { FolderOpen, Settings, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { Button } from './ui/button';

export const TitleBar: React.FC = () => {
    const { setRootPath, syncStats, fetchSyncStats, triggerResync } = useStore();
    const { setSettingsOpen, rootFolder } = useSettingsStore();

    React.useEffect(() => {
        fetchSyncStats();
        const interval = setInterval(fetchSyncStats, 1000);
        return () => clearInterval(interval);
    }, [fetchSyncStats]);

    const isSyncing = syncStats?.status !== 'idle';
    const progress = syncStats && syncStats.totalFiles > 0 ? (syncStats.processedFiles / syncStats.totalFiles) * 100 : 0;

    return (
        <div className="h-10 bg-background border-b border-border flex items-center justify-between px-4 pl-20 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span className="text-foreground">GenStudio</span>
                    {rootFolder && (
                        <>
                            <span className="opacity-50">/</span>
                            <span className="truncate max-w-[200px]">{rootFolder.split('/').pop()}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {syncStats && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            {isSyncing ? (
                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            ) : (
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                            )}
                            <span>{isSyncing ? 'Syncing...' : 'Ready'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>{syncStats.processedFiles} / {syncStats.totalFiles}</span>
                            {isSyncing && (
                                <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={triggerResync}
                            disabled={isSyncing}
                            title="Resync"
                        >
                            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                        </Button>
                    </div>
                )}

                <div className="h-4 w-[1px] bg-border" />

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
