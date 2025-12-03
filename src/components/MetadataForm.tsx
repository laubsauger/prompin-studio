import React, { useState, useEffect, useMemo } from 'react';
import type { Asset, AssetMetadata } from '../types';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { X, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
import { AssetPickerDialog } from './AssetPickerDialog';
import { CreateTagDialog } from './CreateTagDialog';

export const STORAGE_KEYS = {
    AUTHOR: 'gs_last_author',
    PROJECT: 'gs_last_project',
    SCENE: 'gs_last_scene',
    SHOT: 'gs_last_shot',
    MODEL: 'gs_last_model'
};

interface MetadataFormProps {
    initialMetadata: Partial<AssetMetadata>;
    onChange: (metadata: AssetMetadata) => void;
    asset?: Asset; // Optional, for context like existing tags on the asset
    showLineage?: boolean;
    tags?: string[]; // Selected tag IDs
    onTagsChange?: (tags: string[]) => void; // Callback for tag selection changes
}

export const MetadataForm: React.FC<MetadataFormProps> = ({
    initialMetadata,
    onChange,
    asset,
    showLineage = true,
    tags: propTags,
    onTagsChange
}) => {
    const assets = useStore(state => state.assets);
    const allTags = useStore(state => state.tags);
    const createTag = useStore(state => state.createTag);

    // We maintain local state for the form, initialized with props
    const [metadata, setMetadata] = useState<AssetMetadata>(initialMetadata as AssetMetadata);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const [openAuthor, setOpenAuthor] = useState(false);
    const [openTags, setOpenTags] = useState(false);
    const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);

    // Local state for tags if not controlled
    const [localTagIds, setLocalTagIds] = useState<string[]>([]);

    const selectedTagIds = propTags !== undefined ? propTags : localTagIds;

    // Get unique authors from existing assets
    const authors = useMemo(() => {
        const unique = new Set<string>();
        // Add current user/default
        unique.add('me');
        assets.forEach(a => {
            if (a.metadata.authorId) unique.add(a.metadata.authorId);
        });
        return Array.from(unique).sort();
    }, [assets]);

    // Initialize with persisted values if empty, ONLY on mount
    useEffect(() => {
        setMetadata(prev => ({
            ...prev,
            authorId: prev.authorId || localStorage.getItem(STORAGE_KEYS.AUTHOR) || 'me',
            project: prev.project || localStorage.getItem(STORAGE_KEYS.PROJECT) || '',
            scene: prev.scene || localStorage.getItem(STORAGE_KEYS.SCENE) || '',
            shot: prev.shot || localStorage.getItem(STORAGE_KEYS.SHOT) || '',
            model: prev.model || localStorage.getItem(STORAGE_KEYS.MODEL) || '',
        }));
    }, []);

    // Propagate changes to parent
    useEffect(() => {
        onChange(metadata);
    }, [metadata, onChange]);

    // Update local state if initialMetadata changes significantly (e.g. switching assets)
    // We need to be careful not to overwrite user input if they are typing
    // For now, we assume the parent controls when to reset the form by remounting or changing a key
    useEffect(() => {
        if (asset) {
            setMetadata(asset.metadata);
            if (propTags === undefined) {
                setLocalTagIds(asset.tags?.map(t => t.id) || []);
            }
        }
    }, [asset, propTags]);


    const handleInputChange = (key: keyof AssetMetadata, value: any) => {
        setMetadata(prev => {
            const next = { ...prev, [key]: value };
            // Persist immediately for better UX? Or only on save?
            // The user requested persistence for "next one", so saving on change or unmount is good.
            // Let's persist on change for the keys we care about.
            if (key === 'authorId') localStorage.setItem(STORAGE_KEYS.AUTHOR, value);
            if (key === 'project') localStorage.setItem(STORAGE_KEYS.PROJECT, value);
            if (key === 'scene') localStorage.setItem(STORAGE_KEYS.SCENE, value);
            if (key === 'shot') localStorage.setItem(STORAGE_KEYS.SHOT, value);
            if (key === 'model') localStorage.setItem(STORAGE_KEYS.MODEL, value);
            return next;
        });
    };

    const handleAssetsSelected = (selectedAssets: Asset[]) => {
        const currentInputs = metadata.inputs || [];
        const newInputs = selectedAssets.map(a => a.id);
        const mergedInputs = Array.from(new Set([...currentInputs, ...newInputs]));
        handleInputChange('inputs', mergedInputs);
    };

    const removeInput = (input: string) => {
        const currentInputs = metadata.inputs || [];
        handleInputChange('inputs', currentInputs.filter(i => i !== input));
    };

    // For tags, if we have an asset, we might be editing it directly (live).
    // If we don't (ingestion), we are just building a list of tag IDs to apply later.
    // The current MetadataEditor implementation mixed these.
    // Let's standardize: The form manages a list of tag IDs.
    // If `asset` is provided, we might need to sync with it, but `MetadataEditor` was doing direct API calls.
    // To make this reusable for Ingestion (which doesn't have an asset yet), we should probably just return the selected tags in the metadata.
    // BUT `AssetMetadata` doesn't have `tags` field in `types.ts` (it's on `Asset`).
    // Let's check `types.ts`. `Asset` has `tags`. `AssetMetadata` does not.
    // So we need to handle tags separately or add them to the form state.

    // We'll add a local `selectedTagIds` state.


    const toggleTag = (tagId: string) => {
        const isSelected = selectedTagIds.includes(tagId);
        let newIds;
        if (isSelected) {
            newIds = selectedTagIds.filter(id => id !== tagId);
        } else {
            newIds = [...selectedTagIds, tagId];
        }

        if (onTagsChange) {
            onTagsChange(newIds);
        } else {
            setLocalTagIds(newIds);
        }
    };

    // We need to expose tags to the parent if it's ingestion
    // Let's add `onTagsChange` to props.

    return (
        <div className="space-y-6">
            {/* Core Metadata */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 flex flex-col">
                    <Label>Author</Label>
                    <Popover open={openAuthor} onOpenChange={setOpenAuthor}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openAuthor}
                                className="justify-between"
                            >
                                {metadata.authorId === 'me' ? 'Me' : (metadata.authorId || "Select author...")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                            <Command>
                                <CommandInput placeholder="Search author..." />
                                <CommandList>
                                    <CommandEmpty>No author found.</CommandEmpty>
                                    <CommandGroup>
                                        {authors.map((author) => (
                                            <CommandItem
                                                key={author}
                                                value={author}
                                                onSelect={(currentValue) => {
                                                    handleInputChange('authorId', currentValue);
                                                    setOpenAuthor(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        metadata.authorId === author ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {author === 'me' ? 'Me' : author}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
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

            {/* AI / Generation Info */}
            <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Generation Details</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="model">Model</Label>
                        <Input
                            id="model"
                            value={metadata.model || ''}
                            onChange={(e) => handleInputChange('model', e.target.value)}
                            placeholder="e.g. Stable Diffusion XL"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="platformUrl">Platform URL</Label>
                        <Input
                            id="platformUrl"
                            value={metadata.platformUrl || ''}
                            onChange={(e) => handleInputChange('platformUrl', e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="prompt">Prompt</Label>
                    <Textarea
                        id="prompt"
                        value={metadata.prompt || ''}
                        onChange={(e) => handleInputChange('prompt', e.target.value)}
                        placeholder="Generation prompt..."
                        className="min-h-[100px] font-mono text-sm"
                    />
                </div>
            </div>

            {/* Tags & Inputs */}
            <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Organization</h4>

                <div className="space-y-2 flex flex-col">
                    <Label>Tags</Label>
                    <Popover open={openTags} onOpenChange={setOpenTags}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openTags}
                                className="justify-between"
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
                                            onSelect={() => {
                                                setOpenTags(false);
                                                setIsCreateTagOpen(true);
                                            }}
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

                <CreateTagDialog
                    isOpen={isCreateTagOpen}
                    onClose={() => setIsCreateTagOpen(false)}
                    onCreateTag={async (name, color) => {
                        const newTag = await createTag(name, color);
                        // Auto-select the new tag
                        toggleTag(newTag.id);
                    }}
                />

                {showLineage && (
                    <div className="space-y-2">
                        <Label>Input Assets (Lineage)</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {metadata.inputs?.map(input => (
                                <Badge key={input} variant="outline" className="flex items-center gap-1">
                                    <span className="truncate max-w-[100px]">{input.substring(0, 8)}...</span>
                                    <button onClick={() => removeInput(input)} className="hover:text-destructive">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <Button
                            type="button"
                            onClick={() => setIsAssetPickerOpen(true)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Input Assets...
                        </Button>
                    </div>
                )}
            </div>

            <AssetPickerDialog
                isOpen={isAssetPickerOpen}
                onClose={() => setIsAssetPickerOpen(false)}
                onSelect={handleAssetsSelected}
                multiSelect={true}
                initialSelectedIds={metadata.inputs || []}
            />
        </div>
    );
};
