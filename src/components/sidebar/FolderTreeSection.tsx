import React, { useState } from 'react';
import { Folder, FolderOpen, Plus, Minus } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SidebarSection } from './SidebarSection';
import { useFolderTree, type TreeNode } from './useFolderTree';

interface FolderTreeSectionProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const FolderTreeSection: React.FC<FolderTreeSectionProps> = ({ isOpen, onToggle }) => {
    const folderTree = useFolderTree();
    const currentPath = useStore(state => state.currentPath);
    const setCurrentPath = useStore(state => state.setCurrentPath);
    const folderColors = useStore(state => state.folderColors);
    const setFolderColor = useStore(state => state.setFolderColor);

    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

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
                            isSelected && "bg-accent text-accent-foreground",
                            node.count === 0 && "opacity-50"
                        )}
                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                        onContextMenu={(e) => handleContextMenu(e, node.path)}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 p-0 hover:bg-transparent"
                            onClick={(e) => hasChildren ? toggleExpand(node.path, e) : undefined}
                        >
                            {hasChildren && (
                                isExpanded ? <Minus className="h-3 w-3 opacity-50" /> : <Plus className="h-3 w-3 opacity-50" />
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 justify-start gap-2 font-normal h-8 px-2 hover:bg-transparent min-w-0"
                            onClick={() => setCurrentPath(node.path)}
                        >
                            {isSelected ?
                                <FolderOpen className="h-4 w-4 shrink-0" style={{ color: folderColor || 'var(--primary)' }} /> :
                                <Folder className="h-4 w-4 shrink-0" style={{ color: folderColor || 'currentColor' }} />
                            }
                            <span className="truncate flex-1 min-w-0 text-left">{node.name}</span>
                            <span className="text-[10px] text-muted-foreground opacity-70 shrink-0 ml-1">{node.count}</span>
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
        <>
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

            <SidebarSection
                title="Folders"
                isOpen={isOpen}
                onToggle={onToggle}
            >
                {Object.values(folderTree.children).length === 0 ? (
                    <div className="px-4 py-2 text-xs text-muted-foreground">No folders found</div>
                ) : (
                    Object.values(folderTree.children)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(child => renderTree(child))
                )}
            </SidebarSection>
        </>
    );
};
