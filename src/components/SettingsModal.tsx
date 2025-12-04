import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select } from './ui/select';
import { useSettingsStore } from '../store/settings';
import { useStore } from '../store';
import { Button } from './ui/button';

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onOpenChange }) => {
    const { theme, defaultView, autoCheckUpdates, setTheme, setDefaultView, setAutoCheckUpdates } = useSettingsStore();

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your preferences for Gen Studio.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
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
                        <div className="flex flex-col gap-1">
                            <Label>Thumbnails</Label>
                            <span className="text-xs text-muted-foreground">Regenerate all video thumbnails</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                useStore.getState().regenerateThumbnails();
                            }}
                        >
                            Regenerate
                        </Button>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex flex-col gap-1">
                            <Label>AI Indexing</Label>
                            <span className="text-xs text-muted-foreground">Generate embeddings for similarity search</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const ipc = (window as any).ipcRenderer;
                                if (ipc) {
                                    ipc.invoke('generate-embeddings');
                                }
                            }}
                        >
                            Generate
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
            </DialogContent>
        </Dialog>
    );
};
