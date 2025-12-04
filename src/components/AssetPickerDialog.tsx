import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AssetBrowser } from './AssetBrowser';
import { FilterBarUI } from './FilterBar';
import { useStore } from '../store';
import type { Asset, AssetStatus } from '../types';
import { Button } from './ui/button';

interface AssetPickerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (assets: Asset[]) => void;
    multiSelect?: boolean;
    initialSelectedIds?: string[];
}

export const AssetPickerDialog: React.FC<AssetPickerDialogProps> = ({
    isOpen,
    onClose,
    onSelect,
    multiSelect = false,
    initialSelectedIds = []
}) => {
    const assets = useStore(state => state.assets);

    // Local state for picker
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [thumbnailSize, setThumbnailSize] = useState(150);

    // Local filter state
    const [filter, setFilter] = useState<AssetStatus | 'all'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: 'createdAt' | 'updatedAt' | 'path'; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
    const [filterConfig, setFilterConfig] = useState<{ likedOnly: boolean; type: 'all' | 'image' | 'video'; tagId?: string | null; status?: AssetStatus | 'all' }>({ likedOnly: false, type: 'all' });

    const filteredAssets = useMemo(() => {
        let result = assets || [];

        // 1. Filter by Status
        if (filter !== 'all') {
            result = result.filter(a => a.status === filter);
        }

        // 2. Filter by Liked
        if (filterConfig.likedOnly) {
            result = result.filter(a => a.metadata.liked);
        }

        // 3. Filter by Type
        if (filterConfig.type && filterConfig.type !== 'all') {
            result = result.filter(a => a.type === filterConfig.type);
        }

        // 4. Sort
        return [...result].sort((a, b) => {
            const { key, direction } = sortConfig;
            let valA = key === 'path' ? a.path : (a.metadata as any)[key] || 0;
            let valB = key === 'path' ? b.path : (b.metadata as any)[key] || 0;

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [assets, filter, filterConfig, sortConfig]);

    const handleAssetClick = (asset: Asset) => {
        if (multiSelect) {
            const newSelected = new Set(selectedIds);
            if (newSelected.has(asset.id)) {
                newSelected.delete(asset.id);
            } else {
                newSelected.add(asset.id);
            }
            setSelectedIds(newSelected);
        } else {
            setSelectedIds(new Set([asset.id]));
            // Auto-confirm for single select? Maybe not, let user confirm.
        }
    };

    const handleConfirm = () => {
        const selectedAssets = assets.filter(a => selectedIds.has(a.id));
        onSelect(selectedAssets);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>Select Assets</DialogTitle>
                </DialogHeader>

                <div className="p-2 border-b bg-muted/30">
                    <FilterBarUI
                        thumbnailSize={thumbnailSize}
                        onThumbnailSizeChange={setThumbnailSize}
                        filter={filter}
                        sortConfig={sortConfig}
                        onSortConfigChange={(key, direction) => setSortConfig({ key, direction })}
                        filterConfig={filterConfig}
                        onFilterConfigChange={(config) => setFilterConfig(prev => ({ ...prev, ...config }))}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        aspectRatio="square"
                        onAspectRatioChange={() => {}}
                        viewDisplay="clean"
                        onViewDisplayChange={() => {}}
                        onResetFilters={() => {
                            setFilter('all');
                            setFilterConfig({ likedOnly: false, type: 'all' });
                        }}
                    />
                </div>

                <div className="flex-1 min-h-0 p-4 bg-background">
                    <AssetBrowser
                        assets={filteredAssets}
                        viewMode={viewMode}
                        thumbnailSize={thumbnailSize}
                        onAssetClick={handleAssetClick}
                        selectedIds={selectedIds}
                    />
                </div>

                <div className="p-4 border-t flex justify-between items-center bg-muted/30">
                    <div className="text-sm text-muted-foreground">
                        {selectedIds.size} asset{selectedIds.size !== 1 && 's'} selected
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
                            Select
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
