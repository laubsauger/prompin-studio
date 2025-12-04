import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon, Video, Info, Clock, Heart, MessageSquare, Folder, Sparkles, FileText, Save, Plus, ExternalLink, Trash2, MoreHorizontal, Check, GitFork, StickyNote } from 'lucide-react';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { formatFileSize, formatRelativeDate } from '../utils/format';
import { MetadataForm } from './MetadataForm';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { SidebarSection } from './sidebar/SidebarSection';
import { InlineEdit } from './InlineEdit';
import { InputAssetThumbnail } from './InputAssetThumbnail';
import { AssetPickerDialog } from './AssetPickerDialog';
import { CreateTagDialog } from './CreateTagDialog';
import { StatusSelector } from './StatusSelector';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";
import type { AssetMetadata, Asset } from '../types';

export function AssetInspector() {
  const inspectorCollapsed = useSettingsStore(state => state.inspectorCollapsed);
  const toggleInspector = useSettingsStore(state => state.toggleInspector);
  const inspectorAssetId = useStore(state => state.inspectorAsset?.id);
  // Get live asset from store to ensure sync
  const asset = useStore(state => state.assets.find(a => a.id === inspectorAssetId));

  const clearInspectorAsset = useStore(state => state.clearInspectorAsset);
  const updateAssetMetadata = useStore(state => state.updateAssetMetadata);
  const updateAssetStatus = useStore(state => state.updateAssetStatus);
  const toggleLike = useStore(state => state.toggleLike);
  const deleteAsset = useStore(state => state.deleteAsset);
  const allTags = useStore(state => state.tags);
  const addTagToAsset = useStore(state => state.addTagToAsset);
  const removeTagFromAsset = useStore(state => state.removeTagFromAsset);
  const createTag = useStore(state => state.createTag);

  // Tools actions
  const setLineageAssetId = useStore(state => state.setLineageAssetId);
  const addActiveView = useStore(state => state.addActiveView);
  const addToScratchPad = useStore(state => state.addToScratchPad);
  const scratchPads = useStore(state => state.scratchPads);
  const createScratchPad = useStore(state => state.createScratchPad);
  const setCurrentPath = useStore(state => state.setCurrentPath);
  const setFilterConfig = useStore(state => state.setFilterConfig);
  const setViewMode = useStore(state => state.setViewMode);
  // const setViewingAssetId = useStore(state => state.setViewingAssetId); // Unused for now

  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isMetadataOpen, setIsMetadataOpen] = useState(true);
  const [isTagsOpen, setIsTagsOpen] = useState(true);
  const [isEngagementOpen, setIsEngagementOpen] = useState(true);
  const [isLineageOpen, setIsLineageOpen] = useState(true);

  const [editedMetadata, setEditedMetadata] = useState<AssetMetadata | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; fullName: string } | null>(null);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);

  useEffect(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.invoke('get-current-user').then(setCurrentUser);
    }
  }, []);

  // Reset state when asset changes
  useEffect(() => {
    if (asset) {
      setEditedMetadata(asset.metadata);
      setIsDirty(false);
    }
  }, [asset?.id]); // Only reset when ID changes

  const handleMetadataChange = (newMetadata: AssetMetadata) => {
    setEditedMetadata(newMetadata);
    setIsDirty(true);
  };

  const handleSaveMetadata = async () => {
    if (asset && editedMetadata) {
      await updateAssetMetadata(asset.id, editedMetadata);
      setIsDirty(false);
    }
  };

  const handleInlineSave = async (key: keyof AssetMetadata, value: string) => {
    if (asset) {
      const newMetadata = { ...asset.metadata, [key]: value };
      await updateAssetMetadata(asset.id, newMetadata);
      setEditedMetadata(newMetadata);
    }
  };

  const handleAddInput = async (selectedAssets: Asset[]) => {
    if (asset) {
      const currentInputs = asset.metadata.inputs || [];
      const newInputs = selectedAssets.map(a => a.id);
      const mergedInputs = Array.from(new Set([...currentInputs, ...newInputs]));
      const newMetadata = { ...asset.metadata, inputs: mergedInputs };
      await updateAssetMetadata(asset.id, newMetadata);
      setEditedMetadata(newMetadata);
    }
  };

  const handleRemoveInput = async (inputId: string) => {
    if (asset) {
      const currentInputs = asset.metadata.inputs || [];
      const newInputs = currentInputs.filter(id => id !== inputId);
      const newMetadata = { ...asset.metadata, inputs: newInputs };
      await updateAssetMetadata(asset.id, newMetadata);
      setEditedMetadata(newMetadata);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!asset) return;
    const hasTag = asset.tags?.some(t => t.id === tagId);
    if (hasTag) {
      await removeTagFromAsset(asset.id, tagId);
    } else {
      await addTagToAsset(asset.id, tagId);
    }
  };

  const handleOpenFile = () => {
    if (asset && window.ipcRenderer) {
      window.ipcRenderer.invoke('open-file', asset.path);
    }
  };

  const handleDelete = async () => {
    if (asset && confirm('Are you sure you want to delete this asset?')) {
      await deleteAsset(asset.id);
      clearInspectorAsset();
    }
  };

  const isVideo = asset?.type === 'video';
  const isImage = asset?.type === 'image';

  // Use thumbnail protocol for video thumbnails if available, otherwise media protocol
  const previewSrc = asset ? (
    isVideo && asset.thumbnailPath
      ? `thumbnail://${asset.thumbnailPath}`
      : `media://${asset.path}`
  ) : '';

  return (
    <div
      className={cn(
        "border-l border-border bg-card/80 dark:bg-card/70 flex flex-col h-full transition-all duration-300 relative",
        inspectorCollapsed ? "w-0 border-none" : "w-80"
      )}
    >
      {/* Collapse Toggle Button */}
      <button
        className={cn(
          "absolute z-50 flex items-center justify-center bg-card/80 dark:bg-card/70 border border-border shadow-sm hover:bg-accent/50 transition-all duration-200 group",
          "top-[11px]",
          inspectorCollapsed
            ? "right-0 px-1 py-4 rounded-l-md border-r-0"
            : "-left-[13px] px-0.5 py-3 rounded-md"
        )}
        onClick={toggleInspector}
        title={inspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
      >
        {inspectorCollapsed ? (
          <ChevronLeft className="h-4 w-3 text-muted-foreground group-hover:text-foreground" />
        ) : (
          <ChevronRight className="h-4 w-3 text-muted-foreground group-hover:text-foreground" />
        )}
      </button>

      <div className={cn("flex-1 flex flex-col overflow-hidden w-80", inspectorCollapsed && "hidden")}>
        {!asset ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-muted-foreground">
              <Info className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No asset selected</p>
              <p className="text-xs mt-1">Click on an asset to inspect</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header with preview */}
            <div className="border-b border-border flex-shrink-0 bg-card z-10">
              {/* Asset Preview */}
              <div className="relative bg-muted/30 aspect-video group">
                <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50">
                  {isImage || isVideo ? (
                    <img
                      src={previewSrc}
                      alt={asset.path}
                      className="max-w-full max-h-full object-contain shadow-sm"
                      onError={(e) => {
                        // Fallback if image fails
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.classList.add('flex-col');
                        const icon = document.createElement('div');
                        icon.innerHTML = '<svg class="h-12 w-12 text-muted-foreground/50" ...></svg>'; // Simplified
                      }}
                    />
                  ) : (
                    <FileText className="h-16 w-16 text-muted-foreground/50" />
                  )}
                  {/* Play icon overlay for videos */}
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/50 rounded-full p-2 backdrop-blur-sm">
                        <Video className="h-6 w-6 text-white/90" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Close button overlay */}
                <button
                  onClick={clearInspectorAsset}
                  className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm rounded-md hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Status Badge Overlay */}
                <div className="absolute top-2 left-2 z-20">
                  <StatusSelector
                    currentStatus={asset.status}
                    onStatusChange={(status) => updateAssetStatus(asset.id, status)}
                    compact={true}
                    overlayStyle={true}
                  />
                </div>

                {/* Quick Actions Overlay */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="secondary" className="h-7 w-7 bg-background/80 backdrop-blur-sm" onClick={() => toggleLike(asset.id)}>
                    <Heart className={cn("h-3.5 w-3.5", asset.metadata.liked && "fill-red-500 text-red-500")} />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7 bg-background/80 backdrop-blur-sm" onClick={handleOpenFile} title="Open in default app">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Asset name and type */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {isVideo ? <Video className="h-5 w-5 text-muted-foreground flex-shrink-0" /> : <ImageIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                    <span className="text-sm font-medium truncate select-text" title={asset.path.split('/').pop()}>{asset.path.split('/').pop()}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Tools Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => {
                          setLineageAssetId(asset.id);
                        }}>
                          <GitFork className="mr-2 h-4 w-4" /> View Lineage
                        </DropdownMenuItem>

                        <DropdownMenuItem onSelect={() => {
                          const name = `Similar to ${asset.path.split('/').pop()}`;
                          addActiveView(name, {
                            relatedToAssetId: asset.id,
                            semantic: true,
                            type: 'all',
                            status: 'all',
                            likedOnly: false,
                          });
                          // Switch to view logic...
                          const views = useStore.getState().activeViews;
                          const view = views.find(v => v.name === name);
                          if (view) {
                            setCurrentPath(null);
                            setFilterConfig(view.filterConfig);
                            setViewMode('grid');
                          }
                        }}>
                          <Sparkles className="mr-2 h-4 w-4 text-purple-400" /> Find Similar
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel>Scratch Pad</DropdownMenuLabel>
                        {scratchPads.length === 0 ? (
                          <DropdownMenuItem disabled className="text-muted-foreground italic">
                            No Scratch Pads
                          </DropdownMenuItem>
                        ) : (
                          scratchPads.map(pad => (
                            <DropdownMenuItem
                              key={pad.id}
                              onSelect={() => addToScratchPad(pad.id, [asset.id])}
                            >
                              <StickyNote className="mr-2 h-4 w-4" />
                              Add to {pad.name}
                            </DropdownMenuItem>
                          ))
                        )}
                        <DropdownMenuItem onSelect={() => createScratchPad('New Scratch Pad', [asset.id])}>
                          <Plus className="mr-2 h-4 w-4" /> Create New Pad...
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Key Metadata Inline Edit */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                  <InlineEdit
                    label="Author"
                    value={asset.metadata.authorId || ''}
                    onSave={(val) => handleInlineSave('authorId', val)}
                    placeholder="Add author"
                  />
                  <InlineEdit
                    label="Project"
                    value={asset.metadata.project || ''}
                    onSave={(val) => handleInlineSave('project', val)}
                    placeholder="Add project"
                  />
                  <InlineEdit
                    label="Scene"
                    value={asset.metadata.scene || ''}
                    onSave={(val) => handleInlineSave('scene', val)}
                    placeholder="Add scene"
                  />
                  <InlineEdit
                    label="Shot"
                    value={asset.metadata.shot || ''}
                    onSave={(val) => handleInlineSave('shot', val)}
                    placeholder="Add shot"
                  />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {asset.metadata?.fileSize && (
                    <span>{formatFileSize(asset.metadata.fileSize)}</span>
                  )}
                  {asset.metadata?.width && asset.metadata?.height && (
                    <span>{asset.metadata.width}×{asset.metadata.height}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="py-2 pb-10">

                {/* Input Assets (Lineage) */}
                <SidebarSection
                  title="Input Assets"
                  isOpen={isLineageOpen}
                  onToggle={() => setIsLineageOpen(!isLineageOpen)}
                >
                  <div className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {asset.metadata.inputs?.map(input => (
                        <InputAssetThumbnail
                          key={input}
                          assetId={input}
                          onRemove={() => handleRemoveInput(input)}
                        />
                      ))}
                      <button
                        onClick={() => setIsAssetPickerOpen(true)}
                        className="w-12 h-12 rounded-md border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 bg-muted/20 hover:bg-muted/40 flex items-center justify-center transition-all"
                        title="Add Input Asset"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </SidebarSection>

                {/* Tags Section */}
                <SidebarSection
                  title="Tags"
                  isOpen={isTagsOpen}
                  onToggle={() => setIsTagsOpen(!isTagsOpen)}
                >
                  <div className="px-4 py-2">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {asset.tags?.map((tag) => (
                        <div
                          key={tag.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 border border-border/50 rounded-full text-xs transition-colors hover:bg-muted group"
                        >
                          {tag.color && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          <span className="font-medium">{tag.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleTag(tag.id); }}
                            className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/30 border border-dashed border-border/50 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Tag</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search tags..." />
                            <CommandList>
                              <CommandEmpty>No tag found.</CommandEmpty>
                              <CommandGroup>
                                {allTags.map((tag) => {
                                  const isSelected = asset.tags?.some(t => t.id === tag.id);
                                  return (
                                    <CommandItem
                                      key={tag.id}
                                      value={tag.name}
                                      onSelect={() => handleToggleTag(tag.id)}
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
                                    setIsTagPopoverOpen(false);
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
                    </div>
                  </div>
                </SidebarSection>

                {/* Metadata Editor Section */}
                <SidebarSection
                  title="Metadata"
                  isOpen={isMetadataOpen}
                  onToggle={() => setIsMetadataOpen(!isMetadataOpen)}
                  action={isDirty && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveMetadata();
                      }}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  )}
                >
                  <div className="px-4 py-2">
                    {editedMetadata && (
                      <MetadataForm
                        initialMetadata={editedMetadata}
                        onChange={handleMetadataChange}
                        asset={asset}
                        showLineage={false}
                        currentUser={currentUser}
                        compact={true}
                      />
                    )}
                  </div>
                </SidebarSection>

                {/* Details Section */}
                <SidebarSection
                  title="Details"
                  isOpen={isDetailsOpen}
                  onToggle={() => setIsDetailsOpen(!isDetailsOpen)}
                >
                  <div className="px-4 space-y-3 py-2">
                    {/* File Path */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Folder className="h-3 w-3" />
                        Path
                      </div>
                      <div className="text-xs text-muted-foreground break-all bg-muted/30 p-2 rounded border border-border/50 select-all">
                        {asset.path}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Timestamps
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Created</span>
                          <span title={new Date(asset.createdAt).toLocaleString()}>
                            {formatRelativeDate(new Date(asset.createdAt))}
                          </span>
                        </div>
                        {asset.updatedAt && (
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">Modified</span>
                            <span title={new Date(asset.updatedAt).toLocaleString()}>
                              {formatRelativeDate(new Date(asset.updatedAt))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technical details */}
                    {(asset.metadata?.model || asset.metadata?.platform) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Sparkles className="h-3 w-3" />
                          Generation
                        </div>
                        <div className="space-y-1 text-xs">
                          {asset.metadata?.model && (
                            <div className="flex justify-between py-1 border-b border-border/40">
                              <span className="text-muted-foreground">Model</span>
                              <span className="truncate ml-2">{asset.metadata.model}</span>
                            </div>
                          )}
                          {asset.metadata?.platform && (
                            <div className="flex justify-between py-1 border-b border-border/40">
                              <span className="text-muted-foreground">Platform</span>
                              <span className="truncate ml-2">{asset.metadata.platform}</span>
                            </div>
                          )}
                          {asset.metadata?.seed && (
                            <div className="flex justify-between py-1">
                              <span className="text-muted-foreground">Seed</span>
                              <span className="font-mono text-xs">{asset.metadata.seed}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </SidebarSection>

                {/* Engagement Section */}
                {(asset.metadata?.liked || asset.metadata?.comments?.length) && (
                  <SidebarSection
                    title="Engagement"
                    isOpen={isEngagementOpen}
                    onToggle={() => setIsEngagementOpen(!isEngagementOpen)}
                  >
                    <div className="px-4 space-y-2 py-2">
                      <div className="flex items-center gap-3 text-xs">
                        {asset.metadata?.liked && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-md border border-red-500/20">
                            <Heart className="h-3.5 w-3.5 fill-current" />
                            <span className="font-medium">Liked</span>
                          </div>
                        )}
                        {asset.metadata?.comments && asset.metadata.comments.length > 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md border border-border/50">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>{asset.metadata.comments.length} comments</span>
                          </div>
                        )}
                      </div>
                      {asset.metadata?.comments && asset.metadata.comments.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {asset.metadata.comments.map(comment => (
                            <div key={comment.id} className="text-xs bg-muted/30 rounded-md p-3 border border-border/50">
                              <div className="flex justify-between items-start mb-1.5">
                                <span className="font-medium text-foreground">{comment.authorId}</span>
                                <span className="text-muted-foreground text-[10px]">
                                  {formatRelativeDate(new Date(comment.timestamp))}
                                </span>
                              </div>
                              <p className="text-muted-foreground break-words leading-relaxed">{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SidebarSection>
                )}
              </div>
            </div>

            <AssetPickerDialog
              isOpen={isAssetPickerOpen}
              onClose={() => setIsAssetPickerOpen(false)}
              onSelect={handleAddInput}
              multiSelect={true}
              initialSelectedIds={asset.metadata.inputs || []}
            />

            <CreateTagDialog
              isOpen={isCreateTagOpen}
              onClose={() => setIsCreateTagOpen(false)}
              onCreateTag={async (name, color) => {
                try {
                  const newTag = await createTag(name, color);
                  await addTagToAsset(asset.id, newTag.id);
                } catch (err) {
                  console.error('Failed to create tag:', err);
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}