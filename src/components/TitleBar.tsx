import React from 'react';
import { FolderOpen, Settings } from 'lucide-react';
import { useStore } from '../store';
import { useSettingsStore } from '../store/settings';
import { Button } from './ui/button';

export const TitleBar: React.FC = () => {
    const { setRootPath } = useStore();
    const { setSettingsOpen, rootFolder } = useSettingsStore();

    return (
        <div className="h-10 bg-background border-b border-border flex items-center justify-between px-4 pl-20 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="text-foreground">GenStudio</span>
                {rootFolder && (
                    <>
                        <span className="opacity-50">/</span>
                        <span className="truncate max-w-[300px]">{rootFolder.split('/').pop()}</span>
                    </>
                )}
            </div>

            <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setRootPath()}
                    title="Change Folder"
                >
                    <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSettingsOpen(true)}
                    title="Settings"
                >
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
