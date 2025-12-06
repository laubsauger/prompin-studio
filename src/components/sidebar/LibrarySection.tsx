import React from 'react';
import { Layers, Inbox, Star, GitFork, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SidebarSection } from './SidebarSection';

interface LibrarySectionProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const LibrarySection: React.FC<LibrarySectionProps> = ({ isOpen, onToggle }) => {
    const assets = useStore(state => state.assets);
    const currentPath = useStore(state => state.currentPath);
    const setCurrentPath = useStore(state => state.setCurrentPath);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);
    const lastInboxViewTime = useStore(state => state.lastInboxViewTime);
    const activeTab = useStore(state => state.activeTab);
    const setActiveTab = useStore(state => state.setActiveTab);

    return (
        <SidebarSection
            title="Library"
            isOpen={isOpen}
            onToggle={onToggle}
            className="mt-2"
        >
            <Button
                variant="ghost"
                size="sm"
                className={cn("w-full justify-start gap-2 px-4",
                    activeTab === 'explorer' &&
                    currentPath === null &&
                    !filterConfig.likedOnly &&
                    (!filterConfig.status || filterConfig.status.length === 0) &&
                    !filterConfig.tagId &&
                    !filterConfig.scratchPadId &&
                    !filterConfig.relatedToAssetId &&
                    "bg-accent"
                )}
                onClick={() => {
                    setActiveTab('explorer');
                    setCurrentPath(null);
                    setFilterConfig({
                        likedOnly: false,
                        status: [],
                        relatedToAssetId: undefined,
                        tagId: undefined,
                        scratchPadId: undefined
                    });
                }}
            >
                <Layers className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate min-w-0">All Media</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{assets.length}</span>
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className={cn("w-full justify-start gap-2 px-4", activeTab === 'explorer' && filterConfig.status?.includes('unsorted') && "bg-accent")}
                onClick={() => {
                    setActiveTab('explorer');
                    setCurrentPath(null);
                    setFilterConfig({
                        status: ['unsorted'],
                        likedOnly: false,
                        relatedToAssetId: undefined,
                        tagId: undefined,
                        scratchPadId: undefined
                    });
                    useStore.getState().setLastInboxViewTime(Date.now());
                }}
            >
                <div className="relative shrink-0">
                    <Inbox className="h-4 w-4" />
                    {assets.some(a => a.status === 'unsorted' && a.createdAt > lastInboxViewTime) && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-card" />
                    )}
                </div>
                <span className="flex-1 text-left truncate min-w-0">Inbox</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                    {assets.filter(a => a.status === 'unsorted').length}
                </span>
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className={cn("w-full justify-start gap-2 px-4",
                    activeTab === 'explorer' &&
                    filterConfig.likedOnly &&
                    currentPath === null &&
                    !filterConfig.tagId &&
                    !filterConfig.scratchPadId &&
                    (!filterConfig.status || filterConfig.status.length === 0) &&
                    "bg-accent"
                )}
                onClick={() => {
                    setActiveTab('explorer');
                    setCurrentPath(null);
                    setFilterConfig({
                        likedOnly: true,
                        status: [],
                        relatedToAssetId: undefined,
                        tagId: undefined,
                        scratchPadId: undefined
                    });
                }}
            >
                <Star className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate min-w-0">Favorites</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                    {assets.filter(a => a.metadata.liked).length}
                </span>
            </Button>



            {filterConfig.relatedToAssetId && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 px-4 bg-accent text-accent-foreground"
                    onClick={() => setFilterConfig({ relatedToAssetId: undefined })}
                >
                    <GitFork className="h-4 w-4 rotate-180 shrink-0" />
                    <span className="flex-1 text-left truncate min-w-0">
                        Related to: {assets.find(a => a.id === filterConfig.relatedToAssetId)?.path.split('/').pop() || 'Asset'}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        <Trash2 className="h-3 w-3 hover:text-destructive" />
                    </span>
                </Button>
            )}
        </SidebarSection>
    );
};
