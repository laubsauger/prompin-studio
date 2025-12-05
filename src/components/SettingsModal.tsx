import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Loader2 } from 'lucide-react';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select } from './ui/select';
import { useSettingsStore } from '../store/settings';
import { useStore } from '../store';
import { Button } from './ui/button';
import { SyncDebugPanel } from './SyncDebugPanel';

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onOpenChange }) => {
    const { theme, defaultView, autoCheckUpdates, setTheme, setDefaultView, setAutoCheckUpdates } = useSettingsStore();
    const syncStats = useStore(state => state.syncStats);

    const [thumbnailSuccess, setThumbnailSuccess] = React.useState(false);
    const [embeddingSuccess, setEmbeddingSuccess] = React.useState(false);
    const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = React.useState(false);
    const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = React.useState(false);

    // Track previous states to detect completion from background processes
    const prevStatusRef = React.useRef(syncStats?.status);
    const prevThumbnailProgressRef = React.useRef(syncStats?.thumbnailProgress);

    useEffect(() => {
        // Check for Embedding completion (background)
        if (prevStatusRef.current === 'indexing' && syncStats?.status === 'idle') {
            setEmbeddingSuccess(true);
            setTimeout(() => setEmbeddingSuccess(false), 2000);
        }
        prevStatusRef.current = syncStats?.status;

        // Check for Thumbnail completion (background)
        if (prevThumbnailProgressRef.current && !syncStats?.thumbnailProgress) {
            setThumbnailSuccess(true);
            setTimeout(() => setThumbnailSuccess(false), 2000);
        }
        prevThumbnailProgressRef.current = syncStats?.thumbnailProgress;
    }, [syncStats?.status, syncStats?.thumbnailProgress]);

    // Apply theme effect
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    const [activeTab, setActiveTab] = React.useState<'general' | 'sync'>('general');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your preferences for Gen Studio.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 border-b pb-2 mb-4">
                    <Button
                        variant={activeTab === 'general' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('general')}
                    >
                        General
                    </Button>
                    <Button
                        variant={activeTab === 'sync' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('sync')}
                    >
                        Sync Debug
                    </Button>
                </div>

                {activeTab === 'sync' ? (
                    <SyncDebugPanel />
                ) : (
                    <div className="grid gap-6 py-4 overflow-y-auto pr-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="theme" className="text-right">
                                Theme
                            </Label>
                            <Select
                                id="theme"
                                value={theme}
                                onChange={(e) => setTheme(e.target.value as any)}
                                className="w-[300px]"
                            >
                                <option value="system">System</option>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="view" className="text-right">
                                Default View
                            </Label>
                            <Select
                                id="view"
                                value={defaultView}
                                onChange={(e) => setDefaultView(e.target.value as any)}
                                className="w-[300px]"
                            >
                                <option value="grid">Grid</option>
                                <option value="list">List</option>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="updates" className="text-right">
                                Auto Updates
                            </Label>
                            <div className="w-[300px] flex items-center space-x-2">
                                <Switch
                                    id="updates"
                                    checked={autoCheckUpdates}
                                    onCheckedChange={setAutoCheckUpdates}
                                />
                                <span className="text-sm text-muted-foreground">
                                    {autoCheckUpdates ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t pt-4">
                            <div className="flex flex-col gap-1 flex-1 mr-4">
                                <Label>Thumbnails</Label>
                                <span className="text-xs text-muted-foreground">Regenerate all video thumbnails</span>
                                {syncStats?.thumbnailProgress && (
                                    <div className="mt-2 space-y-1">
                                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-300"
                                                style={{ width: `${(syncStats.thumbnailProgress.current / syncStats.thumbnailProgress.total) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Processing...</span>
                                            <span>{Math.round((syncStats.thumbnailProgress.current / syncStats.thumbnailProgress.total) * 100)}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    setIsRegeneratingThumbnails(true);
                                    try {
                                        await useStore.getState().regenerateThumbnails();
                                        setThumbnailSuccess(true);
                                        setTimeout(() => setThumbnailSuccess(false), 2000);
                                    } finally {
                                        setIsRegeneratingThumbnails(false);
                                    }
                                }}
                                disabled={!!syncStats?.thumbnailProgress || isRegeneratingThumbnails || thumbnailSuccess}
                            >
                                {syncStats?.thumbnailProgress || isRegeneratingThumbnails ? (
                                    <>
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        Processing
                                    </>
                                ) : thumbnailSuccess ? (
                                    <span className="text-green-500 font-medium">Done!</span>
                                ) : (
                                    'Regenerate'
                                )}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between border-t pt-4">
                            <div className="flex flex-col gap-1 flex-1 mr-4">
                                <Label>AI Indexing</Label>
                                <span className="text-xs text-muted-foreground">Generate embeddings for similarity search</span>
                                {syncStats?.status === 'indexing' && syncStats.embeddingProgress && (
                                    <div className="mt-2 space-y-1">
                                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-500 transition-all duration-300"
                                                style={{ width: `${(syncStats.embeddingProgress.current / syncStats.embeddingProgress.total) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Generating embeddings...</span>
                                            <span>{Math.round((syncStats.embeddingProgress.current / syncStats.embeddingProgress.total) * 100)}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    setIsGeneratingEmbeddings(true);
                                    const ipc = (window as any).ipcRenderer;
                                    if (ipc) {
                                        try {
                                            await ipc.invoke('generate-embeddings');
                                            setEmbeddingSuccess(true);
                                            setTimeout(() => setEmbeddingSuccess(false), 2000);
                                        } finally {
                                            setIsGeneratingEmbeddings(false);
                                        }
                                    }
                                }}
                                disabled={syncStats?.status === 'indexing' || isGeneratingEmbeddings || embeddingSuccess}
                            >
                                {syncStats?.status === 'indexing' || isGeneratingEmbeddings ? (
                                    <>
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        Generating
                                    </>
                                ) : embeddingSuccess ? (
                                    <span className="text-green-500 font-medium">Done!</span>
                                ) : (
                                    'Generate'
                                )}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between border-t pt-4">
                            <div className="flex flex-col gap-1">
                                <Label className="text-destructive">Reset App</Label>
                                <span className="text-xs text-muted-foreground">Clear all settings and return to setup</span>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                    const ipc = (window as any).ipcRenderer;
                                    if (ipc) {
                                        const confirmed = await ipc.invoke('show-confirm-dialog', {
                                            title: 'Reset App',
                                            message: 'Are you sure you want to reset the app?',
                                            detail: 'This will clear all settings and reload the application. This action cannot be undone.',
                                            type: 'warning',
                                            buttons: ['Cancel', 'Reset App'],
                                            defaultId: 1,
                                            cancelId: 0
                                        });

                                        if (confirmed) {
                                            useSettingsStore.getState().resetSettings();
                                        }
                                    } else {
                                        // Fallback for non-electron environment (if any)
                                        if (confirm('Are you sure you want to reset the app? This will clear all settings and reload.')) {
                                            useSettingsStore.getState().resetSettings();
                                        }
                                    }
                                }}
                            >
                                Reset App
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
