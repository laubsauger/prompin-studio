import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon, Video, Info, Tag, Clock, Heart, MessageSquare, Folder, Sparkles, FileText } from 'lucide-react';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import type { Asset } from '../types';
import { formatFileSize, formatRelativeDate } from '../utils/format';
import { MetadataEditor } from './MetadataEditor';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { SidebarSection } from './sidebar/SidebarSection';

export function AssetInspector() {
  const inspectorCollapsed = useSettingsStore(state => state.inspectorCollapsed);
  const toggleInspector = useSettingsStore(state => state.toggleInspector);
  const rootFolder = useSettingsStore(state => state.rootFolder);
  const inspectorAsset = useStore(state => state.inspectorAsset);
  const clearInspectorAsset = useStore(state => state.clearInspectorAsset);
  const updateAssetMetadata = useStore(state => state.updateAssetMetadata);

  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(true);
  const [isEngagementOpen, setIsEngagementOpen] = useState(true);

  // Reset sections when asset changes
  useEffect(() => {
    if (inspectorAsset) {
      setIsDetailsOpen(true);
      setIsMetadataOpen(false);
    }
  }, [inspectorAsset?.id]);

  const asset = inspectorAsset;
  const isVideo = asset?.type === 'video';
  const isImage = asset?.type === 'image';

  return (
    <div
      className={cn(
        "border-l border-border bg-background/95 dark:bg-background/80 flex flex-col h-full transition-all duration-300 relative",
        inspectorCollapsed ? "w-0 border-none" : "w-64"
      )}
    >
      {/* Collapse Toggle Button */}
      <div className="absolute -left-3 top-3 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-accent"
          onClick={toggleInspector}
        >
          {inspectorCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      </div>

      <div className={cn("flex-1 flex flex-col overflow-hidden w-64", inspectorCollapsed && "hidden")}>
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
            <div className="border-b border-border">
              {/* Asset Preview */}
              <div className="relative bg-muted/30 aspect-video">
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  {isImage ? (
                    <img
                      src={`file://${rootFolder}/${asset.path}`}
                      alt={asset.path}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : isVideo ? (
                    <video
                      src={`file://${rootFolder}/${asset.path}`}
                      className="max-w-full max-h-full object-contain"
                      controls
                      muted
                    />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                {/* Close button overlay */}
                <button
                  onClick={clearInspectorAsset}
                  className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm rounded-md hover:bg-background transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Asset name and type */}
              <div className="p-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  {isVideo ? <Video className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium truncate">{asset.path.split('/').pop()}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full font-medium",
                    asset.status === 'approved' && "bg-green-500/20 text-green-600 dark:text-green-400",
                    asset.status === 'pending' && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
                    asset.status === 'archived' && "bg-gray-500/20 text-gray-600 dark:text-gray-400",
                    asset.status === 'review_requested' && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                    asset.status === 'unsorted' && "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                  )}>
                    {asset.status}
                  </span>
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
            <div className="flex-1 overflow-y-auto py-2">
              {/* Details Section */}
              <SidebarSection
                title="Details"
                isOpen={isDetailsOpen}
                onToggle={() => setIsDetailsOpen(!isDetailsOpen)}
              >
                <div className="px-3 space-y-2">
                  {/* File Path */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Folder className="h-3 w-3" />
                      Path
                    </div>
                    <div className="text-xs text-muted-foreground break-all bg-muted/30 p-2 rounded">
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
                      <div className="flex justify-between py-1">
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
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">Model</span>
                            <span className="truncate ml-2">{asset.metadata.model}</span>
                          </div>
                        )}
                        {asset.metadata?.platform && (
                          <div className="flex justify-between py-1">
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

              {/* Tags Section */}
              {asset.tags && asset.tags.length > 0 && (
                <SidebarSection
                  title="Tags"
                  isOpen={isTagsOpen}
                  onToggle={() => setIsTagsOpen(!isTagsOpen)}
                >
                  <div className="px-3">
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs"
                        >
                          {tag.color && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          <span>{tag.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </SidebarSection>
              )}

              {/* Metadata Editor Section */}
              <SidebarSection
                title="Metadata"
                isOpen={isMetadataOpen}
                onToggle={() => setIsMetadataOpen(!isMetadataOpen)}
              >
                <div className="px-3">
                  <MetadataEditor
                    asset={asset}
                    onSave={(metadata) => updateAssetMetadata(asset.id, metadata)}
                    compact
                  />
                </div>
              </SidebarSection>

              {/* Engagement Section */}
              {(asset.metadata?.liked || asset.metadata?.comments?.length) && (
                <SidebarSection
                  title="Engagement"
                  isOpen={isEngagementOpen}
                  onToggle={() => setIsEngagementOpen(!isEngagementOpen)}
                >
                  <div className="px-3 space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      {asset.metadata?.liked && (
                        <div className="flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                          <span>Liked</span>
                        </div>
                      )}
                      {asset.metadata?.comments && asset.metadata.comments.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{asset.metadata.comments.length} comments</span>
                        </div>
                      )}
                    </div>
                    {asset.metadata?.comments && asset.metadata.comments.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {asset.metadata.comments.map(comment => (
                          <div key={comment.id} className="text-xs bg-muted/30 rounded p-2">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium">{comment.authorId}</span>
                              <span className="text-muted-foreground text-[10px]">
                                {formatRelativeDate(new Date(comment.timestamp))}
                              </span>
                            </div>
                            <p className="text-muted-foreground break-words">{comment.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SidebarSection>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}