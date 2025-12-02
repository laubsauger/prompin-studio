import React, { useState, useEffect } from 'react';
import type { Asset, AssetMetadata } from '../types';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { X, Plus } from 'lucide-react';
import { AssetPickerDialog } from './AssetPickerDialog';

interface MetadataEditorProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({ isOpen, onClose, asset }) => {
    const updateAssetMetadata = useStore(state => state.updateAssetMetadata);
    const [metadata, setMetadata] = useState<AssetMetadata>(asset.metadata);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);

    useEffect(() => {
        setMetadata(asset.metadata);
    }, [asset]);

    const handleSave = () => {
        updateAssetMetadata(asset.id, metadata);
        onClose();
    };

    const handleInputChange = (key: keyof AssetMetadata, value: any) => {
        setMetadata(prev => ({ ...prev, [key]: value }));
    };

    const handleAssetsSelected = (selectedAssets: Asset[]) => {
        const currentInputs = metadata.inputs || [];
        const newInputs = selectedAssets.map(a => a.id);
        // Merge and deduplicate
        const mergedInputs = Array.from(new Set([...currentInputs, ...newInputs]));
        handleInputChange('inputs', mergedInputs);
    };

    const removeInput = (input: string) => {
        const currentInputs = metadata.inputs || [];
        handleInputChange('inputs', currentInputs.filter(i => i !== input));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Edit Metadata: {asset.path.split('/').pop()}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="author">Author ID</Label>
                                <Input
                                    id="author"
                                    value={metadata.authorId || ''}
                                    onChange={(e) => handleInputChange('authorId', e.target.value)}
                                    placeholder="e.g. user-123"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="project">Project</Label>
                                <Input
                                    id="project"
                                    value={metadata.project || ''}
                                    onChange={(e) => handleInputChange('project', e.target.value)}
                                    placeholder="Project Name"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="scene">Scene</Label>
                                <Input
                                    id="scene"
                                    value={metadata.scene || ''}
                                    onChange={(e) => handleInputChange('scene', e.target.value)}
                                    placeholder="Scene Name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="shot">Shot</Label>
                                <Input
                                    id="shot"
                                    value={metadata.shot || ''}
                                    onChange={(e) => handleInputChange('shot', e.target.value)}
                                    placeholder="Shot Name"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="model">Model</Label>
                            <Input
                                id="model"
                                value={metadata.model || ''}
                                onChange={(e) => handleInputChange('model', e.target.value)}
                                placeholder="AI Model Name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="prompt">Prompt</Label>
                            <Textarea
                                id="prompt"
                                value={metadata.prompt || ''}
                                onChange={(e) => handleInputChange('prompt', e.target.value)}
                                placeholder="Generation prompt..."
                                className="min-h-[100px]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Input Assets (Lineage)</Label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {metadata.inputs?.map(input => (
                                    <Badge key={input} variant="secondary" className="flex items-center gap-1">
                                        {input}
                                        <button onClick={() => removeInput(input)} className="hover:text-destructive">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    onClick={() => setIsAssetPickerOpen(true)}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Input Assets...
                                </Button>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>

            <AssetPickerDialog
                isOpen={isAssetPickerOpen}
                onClose={() => setIsAssetPickerOpen(false)}
                onSelect={handleAssetsSelected}
                multiSelect={true}
                initialSelectedIds={metadata.inputs || []}
            />
        </Dialog>
    );
};
