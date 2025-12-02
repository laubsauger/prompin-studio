import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Folder, FolderOpen, Star, Layers, ChevronDown, ChevronRight, ChevronLeft, Plus, Tag, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { CreateTagDialog } from './CreateTagDialog';
import { ASSET_STATUSES } from '../config/constants';

interface TreeNode {
    name: string;
    path: string;
    children: Record<string, TreeNode>;
    count: number;
}

export const Sidebar: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);

    const assets = useStore(state => state.assets);
    const currentPath = useStore(state => state.currentPath);
    const setCurrentPath = useStore(state => state.setCurrentPath);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);
    const tags = useStore(state => state.tags);

    // Build folder tree from assets
    const folderTree = useMemo(() => {
        const root: TreeNode = { name: 'Root', path: '', children: {}, count: 0 };

        assets.forEach(asset => {
            const parts = asset.path.split('/');
            parts.pop(); // Remove filename

            let current = root;
            let currentPath = '';

            // Update root count
            root.count++;

            parts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!current.children[part]) {
                    current.children[part] = { name: part, path: currentPath, children: {}, count: 0 };
                }
                current = current.children[part];
                current.count++;
            });
        });

        return root;
    }, [assets]);

    const toggleExpand = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const folderColors = useStore(state => state.folderColors);
    const setFolderColor = useStore(state => state.setFolderColor);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, path });
    };

    const handleColorChange = (color: string) => {
        if (contextMenu) {
            setFolderColor(contextMenu.path, color);
            setContextMenu(null);
        }
    };

    // Close context menu on click elsewhere
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const renderTree = (node: TreeNode, depth = 0) => {
        const hasChildren = Object.keys(node.children).length > 0;
        const isSelected = currentPath === (node.path || null);
        const isExpanded = expandedPaths.has(node.path);
        const folderColor = folderColors[node.path];

        return (
            <div key={node.path}>
                {node.path !== '' && (
                    <div
                        className={cn(
                            "flex items-center w-full hover:bg-accent/50 group pr-2",
                            isSelected && "bg-accent text-accent-foreground"
                        )}
                        style={{ paddingLeft: `${depth * 12 + 4}px` }}
                        onContextMenu={(e) => handleContextMenu(e, node.path)}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 p-0 hover:bg-transparent"
                            onClick={(e) => hasChildren ? toggleExpand(node.path, e) : undefined}
                        >
                            {hasChildren && (
                                isExpanded ? <ChevronDown className="h-3 w-3 opacity-50" /> : <ChevronRight className="h-3 w-3 opacity-50" />
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 justify-start gap-2 font-normal h-8 px-2 hover:bg-transparent"
                            onClick={() => setCurrentPath(node.path)}
                        >
                            {isSelected ?
                                <FolderOpen className="h-4 w-4 shrink-0" style={{ color: folderColor || 'var(--primary)' }} /> :
                                <Folder className="h-4 w-4 shrink-0" style={{ color: folderColor || 'currentColor' }} />
                            }
                            <span className="truncate">{node.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground opacity-70">{node.count}</span>
                        </Button>
                    </div>
                )}

                {hasChildren && (isExpanded || node.path === '') && (
                    <div>
                        {Object.values(node.children)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(child => renderTree(child, node.path === '' ? 0 : depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            className={cn(
                "border-r border-border bg-card flex flex-col h-full transition-all duration-300 relative",
                isCollapsed ? "w-0 border-none" : "w-64"
            )}
        >
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-popover border border-border shadow-md rounded-md p-2 flex gap-1"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', ''].map(color => (
                        <button
                            key={color || 'reset'}
                            className={cn(
                                "w-4 h-4 rounded-full border border-border hover:scale-110 transition-transform",
                                !color && "bg-muted relative overflow-hidden"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => handleColorChange(color)}
                            title={color ? color : 'Reset'}
                        >
                            {!color && <div className="absolute inset-0 border-r border-destructive rotate-45 transform origin-center" />}
                        </button>
                    ))}
                </div>
            )}
            <div className="absolute -right-3 top-3 z-50">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-accent"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                </Button>
            </div>

            <div className={cn("flex-1 flex flex-col overflow-hidden w-64", isCollapsed && "hidden")}>
                <div className="p-4 border-b border-border">
                    <h3 className="font-semibold text-sm tracking-tight text-muted-foreground mb-2">Library</h3>
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("w-full justify-start gap-2", currentPath === null && !filterConfig.likedOnly && "bg-accent")}
                            onClick={() => {
                                setCurrentPath(null);
                                setFilterConfig({ likedOnly: false });
                            }}
                        >
                            <Layers className="h-4 w-4" />
                            <span className="flex-1 text-left">All Media</span>
                            <span className="text-[10px] text-muted-foreground">{assets.length}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("w-full justify-start gap-2", filterConfig.likedOnly && "bg-accent")}
                            onClick={() => setFilterConfig({ likedOnly: true })}
                        >
                            <Star className="h-4 w-4" />
                            <span className="flex-1 text-left">Favorites</span>
                            <span className="text-[10px] text-muted-foreground">
                                {assets.filter(a => a.metadata.liked).length}
                            </span>
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    <h3 className="px-4 font-semibold text-sm tracking-tight text-muted-foreground mb-2">Folders</h3>
                    <div className="space-y-0.5 mb-6">
                        {Object.values(folderTree.children).length === 0 ? (
                            <div className="px-4 text-xs text-muted-foreground">No folders found</div>
                        ) : (
                            Object.values(folderTree.children)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(child => renderTree(child))
                        )}
                    </div>

                    <div className="px-4 mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-sm tracking-tight text-muted-foreground">Tags</h3>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setIsCreateTagDialogOpen(true)}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="px-4 space-y-1 mb-6">
                        {tags.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No tags found</div>
                        ) : (
                            tags.map(tag => (
                                <Button
                                    key={tag.id}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "w-full justify-start gap-2 h-7",
                                        filterConfig.tagId === tag.id && "bg-accent"
                                    )}
                                    onClick={() => {
                                        setFilterConfig({
                                            tagId: filterConfig.tagId === tag.id ? null : tag.id
                                        });
                                    }}
                                >
                                    <Tag className="h-3 w-3" style={{ color: tag.color || 'currentColor' }} />
                                    <span className="flex-1 text-left text-xs">{tag.name}</span>
                                </Button>
                            ))
                        )}
                    </div>

                    {/* Status Filters - Workflow Features */}
                    <h3 className="px-4 font-semibold text-sm tracking-tight text-muted-foreground mb-2">Review Status</h3>
                    <div className="px-4 space-y-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "w-full justify-start gap-2 h-7",
                                filterConfig.status === 'review_requested' && "bg-accent"
                            )}
                            onClick={() => {
                                setFilterConfig({
                                    status: filterConfig.status === 'review_requested' ? undefined : 'review_requested'
                                });
                            }}
                        >
                            <AlertCircle className="h-3 w-3 text-yellow-500" />
                            <span className="flex-1 text-left text-xs">Review Requested</span>
                            <span className="text-[10px] text-muted-foreground">
                                {assets.filter(a => a.status === 'review_requested').length}
                            </span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "w-full justify-start gap-2 h-7",
                                filterConfig.status === 'pending' && "bg-accent"
                            )}
                            onClick={() => {
                                setFilterConfig({
                                    status: filterConfig.status === 'pending' ? undefined : 'pending'
                                });
                            }}
                        >
                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                            <span className="flex-1 text-left text-xs">Pending Approval</span>
                            <span className="text-[10px] text-muted-foreground">
                                {assets.filter(a => a.status === 'pending').length}
                            </span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "w-full justify-start gap-2 h-7",
                                filterConfig.status === 'approved' && "bg-accent"
                            )}
                            onClick={() => {
                                setFilterConfig({
                                    status: filterConfig.status === 'approved' ? undefined : 'approved'
                                });
                            }}
                        >
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="flex-1 text-left text-xs">Approved</span>
                            <span className="text-[10px] text-muted-foreground">
                                {assets.filter(a => a.status === 'approved').length}
                            </span>
                        </Button>
                    </div>
                </div>
            </div>

            <CreateTagDialog
                isOpen={isCreateTagDialogOpen}
                onClose={() => setIsCreateTagDialogOpen(false)}
                onCreateTag={useStore.getState().createTag}
            />
        </div>
    );
};
