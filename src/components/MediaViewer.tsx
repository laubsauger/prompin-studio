import React, { useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useStore } from '../store';
import { Button } from './ui/button';
import { X } from 'lucide-react';

export const MediaViewer: React.FC = () => {
    const { viewingAssetId, setViewingAssetId, assets } = useStore();

    const asset = assets.find(a => a.id === viewingAssetId);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setViewingAssetId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setViewingAssetId]);

    if (!asset) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-mono text-sm text-muted-foreground">{asset.path}</span>
                <Button variant="ghost" size="icon" onClick={() => setViewingAssetId(null)}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>

            <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
                {asset.type === 'image' ? (
                    <TransformWrapper>
                        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                            <img
                                src={`file://${asset.path}`}
                                alt={asset.path}
                                className="max-w-full max-h-full object-contain"
                            />
                        </TransformComponent>
                    </TransformWrapper>
                ) : (
                    <video
                        src={`file://${asset.path}`}
                        controls
                        autoPlay
                        className="max-w-full max-h-full"
                    />
                )}
            </div>
        </div>
    );
};
