import React from 'react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { X, Check, Archive, RotateCcw } from 'lucide-react';

export const BulkActionsBar: React.FC = () => {
    const { selectedIds, clearSelection, updateAssetStatus, loadAssets } = useStore();

    if (selectedIds.size === 0) return null;

    const handleBulkStatusUpdate = async (status: 'approved' | 'archived' | 'unsorted') => {
        const promises = Array.from(selectedIds).map(id => updateAssetStatus(id, status));
        await Promise.all(promises);
        clearSelection();
        loadAssets();
    };

    return (
        <Card className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 px-4 shadow-2xl bg-card border-border z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex items-center gap-2 border-r border-border pr-4">
                <Badge variant="secondary" className="h-6">
                    {selectedIds.size} selected
                </Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearSelection}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => handleBulkStatusUpdate('approved')} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleBulkStatusUpdate('archived')}>
                    <Archive className="mr-2 h-4 w-4" /> Archive
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate('unsorted')}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
            </div>
        </Card>
    );
};
