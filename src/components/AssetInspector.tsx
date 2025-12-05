import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Info, Clock, MessageSquare, Folder, Sparkles, Save, Plus, MoreHorizontal, X, Maximize2 } from 'lucide-react';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { formatFileSize, formatRelativeDate } from '../utils/format';
import { MetadataForm } from './MetadataForm';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { SidebarSection } from './sidebar/SidebarSection';
import { InputAssetThumbnail } from './InputAssetThumbnail';
import { AssetPickerDialog } from './AssetPickerDialog';
import { CreateTagDialog } from './CreateTagDialog';
import { SmartMetadataInput } from './SmartMetadataInput';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";
import type { AssetMetadata, Asset } from '../types';
import { AssetMediaPreview } from './AssetMediaPreview';
import { AssetMenuActions } from './AssetMenuActions';
import { CreateScratchPadDialog } from './CreateScratchPadDialog';

export function AssetInspector() {
  const inspectorCollapsed = useSettingsStore(state => state.inspectorCollapsed);
  const toggleInspector = useSettingsStore(state => state.toggleInspector);
  const inspectorAssetId = useStore(state => state.inspectorAsset?.id);
  // Get live asset from store to ensure sync
  const asset = useStore(state => state.assets.find(a => a.id === inspectorAssetId));

  const clearInspectorAsset = useStore(state => state.clearInspectorAsset);
  const updateAssetMetadata = useStore(state => state.updateAssetMetadata);
  const allTags = useStore(state => state.tags);
  const addTagToAsset = useStore(state => state.addTagToAsset);
  const removeTagFromAsset = useStore(state => state.removeTagFromAsset);
  const createTag = useStore(state => state.createTag);
  const createScratchPad = useStore(state => state.createScratchPad);
  const metadataOptions = useStore(state => state.metadataOptions);
  const setViewingAssetId = useStore(state => state.setViewingAssetId);

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
  const [isCreateScratchPadOpen, setIsCreateScratchPadOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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

  const handleAddInput = async (selectedAssets: Asset[] | string[]) => {
    if (asset) {
      const currentInputs = asset.metadata.inputs || [];
      // Handle both Asset objects and asset ID strings
      const newInputs = selectedAssets.map(a => typeof a === 'string' ? a : a.id);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.types.includes('application/json');
    if (data) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const { assetId } = JSON.parse(data);
        // Prevent dropping asset onto itself
        if (assetId && asset && assetId !== asset.id) {
          await handleAddInput([assetId]);
        }
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
    }
  };

  return (
    <div
      className={cn(
        "border-l border-border bg-card/80 dark:bg-card/70 flex flex-col h-full transition-all duration-300 relative min-h-0",
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
              {/* Asset Preview - Reusing AssetMediaPreview */}
              <div className="relative bg-black/90 aspect-video group">
                <AssetMediaPreview
                  asset={asset}
                  showControls={true}
                  showStatus={true}
                  className="aspect-video"
                />

                {/* Action buttons overlay */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {/* Fullscreen button */}
                  <button
                    onClick={() => setViewingAssetId(asset.id)}
                    className="p-1.5 bg-background/80 backdrop-blur-sm rounded-md hover:bg-background transition-colors"
                    title="View fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>

                  {/* Close button */}
                  <button
                    onClick={clearInspectorAsset}
                    className="p-1.5 bg-background/80 backdrop-blur-sm rounded-md hover:bg-background transition-colors"
                    title="Close inspector"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Asset name and type */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-sm font-medium truncate select-text" title={asset.path.split('/').pop()}>{asset.path.split('/').pop()}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Tools Menu - Reusing AssetMenuActions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <AssetMenuActions
                          asset={asset}
                          components={{
                            Item: DropdownMenuItem,
                            Separator: DropdownMenuSeparator,
                            Sub: DropdownMenuSub,
                            SubTrigger: DropdownMenuSubTrigger,
                            SubContent: DropdownMenuSubContent,
                            Label: DropdownMenuLabel
                          }}
                          onCreateTag={() => setIsCreateTagOpen(true)}
                          onCreateScratchPad={() => setIsCreateScratchPadOpen(true)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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

                {/* Details Section */}
                <SidebarSection
                  title="Details"
                  isOpen={isDetailsOpen}
                  onToggle={() => setIsDetailsOpen(!isDetailsOpen)}
                >
                  <div className="px-4 py-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Author</div>
                        <SmartMetadataInput
                          value={asset.metadata.authorId || ''}
                          onChange={(val) => handleInlineSave('authorId', val)}
                          options={metadataOptions.authors}
                          placeholder="Add author"
                          title="Author"
                          className="h-7 text-xs px-2 py-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Project</div>
                        <SmartMetadataInput
                          value={asset.metadata.project || ''}
                          onChange={(val) => handleInlineSave('project', val)}
                          options={metadataOptions.projects}
                          placeholder="Add project"
                          title="Project"
                          className="h-7 text-xs px-2 py-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Scene</div>
                        <SmartMetadataInput
                          value={asset.metadata.scene || ''}
                          onChange={(val) => handleInlineSave('scene', val)}
                          options={metadataOptions.scenes}
                          placeholder="Add scene"
                          title="Scene"
                          className="h-7 text-xs px-2 py-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Shot</div>
                        <SmartMetadataInput
                          value={asset.metadata.shot || ''}
                          onChange={(val) => handleInlineSave('shot', val)}
                          options={metadataOptions.shots}
                          placeholder="Add shot"
                          title="Shot"
                          className="h-7 text-xs px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                </SidebarSection>

                {/* Input Assets (Lineage) */}
                <SidebarSection
                  title="Input Assets"
                  isOpen={isLineageOpen}
                  onToggle={() => setIsLineageOpen(!isLineageOpen)}
                >
                  <div
                    className={cn(
                      "px-4 py-2 transition-all rounded-md",
                      isDraggingOver && "bg-primary/10 ring-2 ring-primary/50"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
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
                        className={cn(
                          "w-24 h-24 rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1",
                          isDraggingOver
                            ? "border-primary bg-primary/20 scale-105"
                            : "border-muted-foreground/30 hover:border-muted-foreground/60 bg-muted/20 hover:bg-muted/40"
                        )}
                        title="Add Input Asset"
                      >
                        <Plus className={cn(
                          "h-5 w-5 transition-all",
                          isDraggingOver ? "text-primary scale-110" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "text-[10px] font-medium",
                          isDraggingOver ? "text-primary" : "text-muted-foreground"
                        )}>
                          {isDraggingOver ? "Drop here" : "Add"}
                        </span>
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
                                        {/* Check icon */}
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
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md border border-border/50">
                            {/* Heart icon handled in AssetMediaPreview, but here we show stats */}
                            <span>Liked</span>
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

            <CreateScratchPadDialog
              isOpen={isCreateScratchPadOpen}
              onClose={() => setIsCreateScratchPadOpen(false)}
              onCreate={createScratchPad}
              initialAssetIds={[asset.id]}
            />
          </>
        )}
      </div>
    </div>
  );
}