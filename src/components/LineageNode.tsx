import React from 'react';
import { Film, Image } from 'lucide-react';
import type { Asset } from '../types';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface LineageNodeProps {
    asset: Asset;
    isRoot?: boolean;
    onClick?: (asset: Asset) => void;
}

export const LineageNode: React.FC<LineageNodeProps> = ({ asset, isRoot = false, onClick }) => {
    const setViewingAssetId = useStore(state => state.setViewingAssetId);

    const thumbnailSrc = asset.type === 'video' && asset.thumbnailPath
        ? `thumbnail://${asset.thumbnailPath}`
        : `media://${asset.path}`;

    const handleClick = () => {
        if (onClick) {
            onClick(asset);
        } else {
            // Open asset in viewer
            setViewingAssetId(asset.id);
        }
    };

    return (
        <div
            className={cn(
                "relative group cursor-pointer transition-all duration-200",
                "bg-background border-2 rounded-lg overflow-hidden",
                isRoot ? "ring-4 ring-primary ring-offset-2 scale-110 shadow-lg" : "border-border hover:border-primary/50 shadow-md hover:shadow-lg",
                "w-48 h-56"
            )}
            onClick={handleClick}
        >
            {/* Thumbnail */}
            <div className="h-36 bg-muted relative overflow-hidden">
                <img
                    src={thumbnailSrc}
                    alt={asset.path}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                        // Fallback to icon on error
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                        }
                    }}
                />
                <div className="hidden absolute inset-0 items-center justify-center bg-muted">
                    {asset.type === 'video' ? (
                        <Film className="h-12 w-12 text-muted-foreground" />
                    ) : (
                        <Image className="h-12 w-12 text-muted-foreground" />
                    )}
                </div>

                {/* Type badge */}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded">
                    {asset.type.toUpperCase()}
                </div>

                {/* Root indicator */}
                {isRoot && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                        Selected
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-2 space-y-1">
                <p className="text-xs font-medium truncate" title={asset.path}>
                    {asset.path.split('/').pop()}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{asset.status}</span>
                    {asset.metadata.liked && (
                        <span className="text-red-500">♥</span>
                    )}
                </div>
                {asset.metadata.inputs && asset.metadata.inputs.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                        {asset.metadata.inputs.length} input{asset.metadata.inputs.length > 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>
    );
};