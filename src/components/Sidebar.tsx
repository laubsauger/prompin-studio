import React, { useMemo } from 'react';
import { useStore } from '../store';
import { Folder, FolderOpen, Star, Tag, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

interface TreeNode {
    name: string;
    path: string;
    children: Record<string, TreeNode>;
}

import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Sidebar: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const assets = useStore(state => state.assets);
    const currentPath = useStore(state => state.currentPath);
    const setCurrentPath = useStore(state => state.setCurrentPath);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);

    // Build folder tree from assets
    const folderTree = useMemo(() => {
        const root: TreeNode = { name: 'Root', path: '', children: {} };

        assets.forEach(asset => {
            const parts = asset.path.split('/');
            parts.pop(); // Remove filename

            let current = root;
            let currentPath = '';

            parts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!current.children[part]) {
                    current.children[part] = { name: part, path: currentPath, children: {} };
                }
                current = current.children[part];
            });
        });

        return root;
    }, [assets]);

    const renderTree = (node: TreeNode, depth = 0) => {
        const hasChildren = Object.keys(node.children).length > 0;
        const isSelected = currentPath === (node.path || null); // Root path is empty string, currentPath is null for root

        return (
            <div key={node.path}>
                {node.path !== '' && ( // Don't render root node itself, just children
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "w-full justify-start gap-2 font-normal h-8",
                            isSelected && "bg-accent text-accent-foreground"
                        )}
                        style={{ paddingLeft: `${depth * 12 + 12}px` }}
                        onClick={() => setCurrentPath(node.path)}
                    >
                        {isSelected ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{node.name}</span>
                    </Button>
                )}

                {hasChildren && (
                    <div>
                        {Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name)).map(child => renderTree(child, node.path === '' ? 0 : depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            className={cn(
                "border-r border-border bg-card flex flex-col h-full transition-all duration-300 relative",
                isCollapsed ? "w-12" : "w-64"
            )}
        >
            <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-2 h-6 w-6 rounded-full border border-border bg-background shadow-sm z-50 hover:bg-accent"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>

            <div className={cn("flex-1 flex flex-col overflow-hidden", isCollapsed && "hidden")}>
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
                            All Media
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("w-full justify-start gap-2", filterConfig.likedOnly && "bg-accent")}
                            onClick={() => setFilterConfig({ likedOnly: true })}
                        >
                            <Star className="h-4 w-4" />
                            Favorites
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    <h3 className="px-4 font-semibold text-sm tracking-tight text-muted-foreground mb-2">Folders</h3>
                    <div className="space-y-0.5">
                        {Object.values(folderTree.children).length === 0 ? (
                            <div className="px-4 text-xs text-muted-foreground">No folders found</div>
                        ) : (
                            Object.values(folderTree.children).sort((a, b) => a.name.localeCompare(b.name)).map(child => renderTree(child))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
