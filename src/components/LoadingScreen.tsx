import React from 'react';
import { Loader2, Image, Film, Folder, FileQuestion } from 'lucide-react';
import { cn } from '../lib/utils';

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
    otherCount
}) => {
    const hasFileCounts = totalFiles !== undefined || imageCount !== undefined ||
                         videoCount !== undefined || folderCount !== undefined;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 max-w-md">
                {/* Logo */}
                <div className="w-20 h-20 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl flex items-center justify-center shadow-2xl">
                    <img src="/white_alpha.png" alt="Prompin' Studio" className="w-14 h-14" />
                </div>

                {/* Message with inline spinner */}
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                    <h2 className="text-xl font-semibold">{message}</h2>
                </div>

                {/* File Counts Grid */}
                {hasFileCounts && (
                    <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-4 min-w-[320px]">
                        {totalFiles !== undefined && (
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                                <span className="text-sm font-medium">Total Files</span>
                                <span className="text-lg font-bold tabular-nums">{totalFiles.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            {imageCount !== undefined && (
                                <div className="flex items-center gap-2">
                                    <Image className="h-4 w-4 text-blue-500" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Images</div>
                                        <div className="font-semibold tabular-nums">{imageCount.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}
                            {videoCount !== undefined && (
                                <div className="flex items-center gap-2">
                                    <Film className="h-4 w-4 text-purple-500" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Videos</div>
                                        <div className="font-semibold tabular-nums">{videoCount.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}
                            {folderCount !== undefined && (
                                <div className="flex items-center gap-2">
                                    <Folder className="h-4 w-4 text-yellow-500" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Folders</div>
                                        <div className="font-semibold tabular-nums">{folderCount.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}
                            {otherCount !== undefined && otherCount > 0 && (
                                <div className="flex items-center gap-2">
                                    <FileQuestion className="h-4 w-4 text-gray-500" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Other</div>
                                        <div className="font-semibold tabular-nums">{otherCount.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Additional Details */}
                {(details || subDetails) && (
                    <div className="text-center space-y-1">
                        {details && (
                            <p className="text-sm text-muted-foreground/70">{details}</p>
                        )}
                        {subDetails && (
                            <p className="text-sm text-muted-foreground">{subDetails}</p>
                        )}
                    </div>
                )}

                {/* Progress Bar */}
                {progress !== undefined && (
                    <div className="w-80 space-y-2">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                            {Math.round(progress)}%
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
