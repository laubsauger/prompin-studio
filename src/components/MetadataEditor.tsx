import React from 'react';
import type { Asset, AssetMetadata } from '../types';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Film } from 'lucide-react';


import { MetadataForm } from './MetadataForm';

interface MetadataEditorProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({ isOpen, onClose, asset }) => {
    const updateAssetMetadata = useStore(state => state.updateAssetMetadata);
    const addTagToAsset = useStore(state => state.addTagToAsset);
    const removeTagFromAsset = useStore(state => state.removeTagFromAsset);


    const [metadata, setMetadata] = React.useState<AssetMetadata>(asset.metadata);
    const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
    const [currentUser, setCurrentUser] = React.useState<{ username: string; fullName: string } | null>(null);

    // Load current user info
    React.useEffect(() => {
        window.ipcRenderer.invoke('get-current-user').then(setCurrentUser);
    }, []);

    // Sync with asset prop when it changes
    React.useEffect(() => {
        setMetadata(asset.metadata);
        setSelectedTagIds(asset.tags?.map(t => t.id) || []);
    }, [asset]);

    const handleSave = async () => {
        // Update metadata
        updateAssetMetadata(asset.id, metadata);

        // Update tags
        const currentTags = asset.tags?.map(t => t.id) || [];
        const toAdd = selectedTagIds.filter(id => !currentTags.includes(id));
        const toRemove = currentTags.filter(id => !selectedTagIds.includes(id));

        for (const tagId of toAdd) {
            await addTagToAsset(asset.id, tagId);
        }
        for (const tagId of toRemove) {
            await removeTagFromAsset(asset.id, tagId);
        }

        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle>Edit Metadata</DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Column: Preview, Info */}
                    <div className="w-2/5 border-r bg-muted/30 flex flex-col overflow-hidden">
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-6">
                                {/* Preview */}
                                <div className="aspect-video rounded-lg overflow-hidden border bg-background flex items-center justify-center relative group">
                                    {asset.type === 'video' ? (
                                        asset.thumbnailPath ? (
                                            <img
                                                src={`thumbnail://${asset.thumbnailPath}`}
                                                alt="Thumbnail"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <Film className="h-12 w-12 text-muted-foreground" />
                                        )
                                    ) : (
                                        <img
                                            src={`media://${asset.path}`}
                                            alt="Preview"
                                            className="w-full h-full object-contain"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">
                                        {asset.type.toUpperCase()}
                                    </div>
                                </div>

                                {/* File Info */}
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">File Info</h4>
                                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                                        <span className="text-muted-foreground">Filename</span>
                                        <span className="truncate" title={asset.path.split('/').pop()}>{asset.path.split('/').pop()}</span>

                                        <span className="text-muted-foreground">Size</span>
                                        <span>{asset.metadata.fileSize ? (asset.metadata.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}</span>

                                        <span className="text-muted-foreground">Dimensions</span>
                                        <span>{asset.metadata.width && asset.metadata.height ? `${asset.metadata.width}x${asset.metadata.height}` : '-'}</span>

                                        {asset.type === 'video' && (
                                            <>
                                                <span className="text-muted-foreground">Duration</span>
                                                <span>{asset.metadata.duration ? new Date(asset.metadata.duration * 1000).toISOString().substr(11, 8) : '-'}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right Column: Metadata Form */}
                    <ScrollArea className="flex-1">
                        <div className="p-6">
                            <MetadataForm
                                initialMetadata={metadata}
                                onChange={setMetadata}
                                asset={asset}
                                showLineage={true}
                                tags={selectedTagIds}
                                onTagsChange={setSelectedTagIds}
                                currentUser={currentUser}
                            />
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    );
};
