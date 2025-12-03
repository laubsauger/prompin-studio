import React from 'react';
import type { Asset, AssetMetadata } from '../types';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Film, Plus, Settings, X, Check, ChevronsUpDown } from 'lucide-react';

import { AssetPickerDialog } from './AssetPickerDialog';
import { Badge } from './ui/badge';
import { CreateTagDialog } from './CreateTagDialog';
import { ManageTagsDialog } from './ManageTagsDialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
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
    const allTags = useStore(state => state.tags);
    const createTag = useStore(state => state.createTag);


    const [metadata, setMetadata] = React.useState<AssetMetadata>(asset.metadata);
    const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = React.useState(false);
    const [openTags, setOpenTags] = React.useState(false);
    const [isCreateTagOpen, setIsCreateTagOpen] = React.useState(false);
    const [isManageTagsOpen, setIsManageTagsOpen] = React.useState(false);
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

    const handleAssetsSelected = (selectedAssets: Asset[]) => {
        const currentInputs = metadata.inputs || [];
        const newInputs = selectedAssets.map(a => a.id);
        const mergedInputs = Array.from(new Set([...currentInputs, ...newInputs]));
        setMetadata(prev => ({ ...prev, inputs: mergedInputs }));
    };

    const toggleTag = (tagId: string) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };



    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle>Edit Metadata</DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Column: Preview, Info, Tags, Inputs */}
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

                                {/* Tags Section */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Tags</h4>
                                    </div>

                                    <Popover open={openTags} onOpenChange={setOpenTags}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openTags}
                                                className="w-full justify-between"
                                            >
                                                {selectedTagIds.length > 0
                                                    ? `${selectedTagIds.length} tags selected`
                                                    : "Select tags..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search tags..." />
                                                <CommandList>
                                                    <CommandEmpty>No tag found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {allTags.map((tag) => {
                                                            const isSelected = selectedTagIds.includes(tag.id);
                                                            return (
                                                                <CommandItem
                                                                    key={tag.id}
                                                                    value={tag.name}
                                                                    onSelect={() => toggleTag(tag.id)}
                                                                >
                                                                    <div
                                                                        className={cn(
                                                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                            isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                                        )}
                                                                    >
                                                                        <Check className={cn("h-4 w-4")} />
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                                                        {tag.name}
                                                                    </div>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                    <CommandGroup>
                                                        <CommandItem
                                                            onSelect={() => setIsCreateTagOpen(true)}
                                                            className="cursor-pointer border-t mt-2 pt-2"
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            Create new tag...
                                                        </CommandItem>
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>

                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {allTags.filter(t => selectedTagIds.includes(t.id)).map(tag => (
                                            <Badge key={tag.id} variant="secondary" className="gap-1" style={{ borderColor: tag.color }}>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                {tag.name}
                                                <button onClick={() => toggleTag(tag.id)} className="ml-1 hover:text-destructive">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right Column: Form with Prompt at top */}
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
            </DialogContent>

            <AssetPickerDialog
                isOpen={isAssetPickerOpen}
                onClose={() => setIsAssetPickerOpen(false)}
                onSelect={handleAssetsSelected}
                multiSelect={true}
                initialSelectedIds={metadata.inputs || []}
            />

            <CreateTagDialog
                isOpen={isCreateTagOpen}
                onClose={() => setIsCreateTagOpen(false)}
                onCreateTag={async (name, color) => {
                    const newTag = await createTag(name, color);
                    toggleTag(newTag.id);
                }}
            />

            <ManageTagsDialog
                isOpen={isManageTagsOpen}
                onClose={() => setIsManageTagsOpen(false)}
            />
        </Dialog>
    );
};
