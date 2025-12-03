import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
    message?: string;
    progress?: number;
    details?: string;
    subDetails?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = 'Loading...',
    progress,
    details,
    subDetails
}) => {
    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6 max-w-md">
                {/* Logo */}
                <div className="w-24 h-24 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl flex items-center justify-center shadow-2xl">
                    <img src="/white_alpha.png" alt="Prompin' Studio" className="w-16 h-16" />
                </div>

                {/* Loading Spinner */}
                <Loader2 className="w-8 h-8 animate-spin text-primary" />

                {/* Message */}
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">{message}</h2>
                    {details && (
                        <p className="text-sm text-muted-foreground/70">{details}</p>
                    )}
                    {subDetails && (
                        <p className="text-sm text-muted-foreground">{subDetails}</p>
                    )}
                </div>

                {/* Progress Bar */}
                {progress !== undefined && (
                    <div className="w-64 space-y-2">
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
