import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select } from './ui/select';
import { useSettingsStore } from '../store/settings';

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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your preferences for Gen Studio.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="theme" className="text-right">
                            Theme
                        </Label>
                        <Select
                            id="theme"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as any)}
                            className="col-span-3"
                        >
                            <option value="system">System</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="view" className="text-right">
                            Default View
                        </Label>
                        <Select
                            id="view"
                            value={defaultView}
                            onChange={(e) => setDefaultView(e.target.value as any)}
                            className="col-span-3"
                        >
                            <option value="grid">Grid</option>
                            <option value="list">List</option>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="updates" className="text-right">
                            Auto Updates
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
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
                </div>
            </DialogContent>
        </Dialog>
    );
};
