import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
    message?: string;
    progress?: number;
    details?: string;
    subDetails?: string;
    totalFiles?: number;
    imageCount?: number;
    videoCount?: number;
    folderCount?: number;
    otherCount?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = 'Loading...',
    progress,
    details,
    subDetails,
    totalFiles,
    imageCount,
    videoCount,
    folderCount,
    // otherCount - unused
}) => {
    const hasFileCounts = totalFiles !== undefined || imageCount !== undefined ||
        videoCount !== undefined || folderCount !== undefined;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-lg p-6 mx-4 space-y-8 bg-card border border-border/50 rounded-xl shadow-2xl">
                {/* Header */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner border border-primary/20">
                            <img src="/white_alpha.png" alt="Logo" className="w-10 h-10 opacity-90" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        </div>
                    </div>

                    <div className="space-y-4 max-w-full">
                        <div className="flex items-center justify-center">
                            <h2 className="text-2xl font-semibold tracking-tight">{message}</h2>
                        </div>
                        {(details || subDetails) && (
                            <div className="text-sm text-muted-foreground space-y-2 flex flex-col items-center">
                                {details && (
                                    <p className="truncate max-w-[400px] mx-auto opacity-70" title={details}>
                                        {details}
                                    </p>
                                )}
                                {subDetails && (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                        <p className="font-medium text-foreground/80">{subDetails}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                {progress !== undefined && (
                    <div className="space-y-2">
                        <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500 ease-out"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                {hasFileCounts && (
                    <div className="grid grid-cols-4 gap-2 pt-2">
                        <div className="flex flex-col items-center p-3 bg-secondary/30 rounded-lg border border-border/50">
                            <span className="text-xs text-muted-foreground mb-1">Total</span>
                            <span className="text-lg font-bold tabular-nums">{totalFiles?.toLocaleString() ?? '-'}</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-secondary/30 rounded-lg border border-border/50">
                            <span className="text-xs text-muted-foreground mb-1">Images</span>
                            <span className="text-lg font-bold tabular-nums text-blue-500">{imageCount?.toLocaleString() ?? '-'}</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-secondary/30 rounded-lg border border-border/50">
                            <span className="text-xs text-muted-foreground mb-1">Videos</span>
                            <span className="text-lg font-bold tabular-nums text-purple-500">{videoCount?.toLocaleString() ?? '-'}</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-secondary/30 rounded-lg border border-border/50">
                            <span className="text-xs text-muted-foreground mb-1">Folders</span>
                            <span className="text-lg font-bold tabular-nums text-yellow-500">{folderCount?.toLocaleString() ?? '-'}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
