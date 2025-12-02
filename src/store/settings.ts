import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    theme: 'light' | 'dark' | 'system';
    defaultView: 'grid' | 'list';
    autoCheckUpdates: boolean;
    isSettingsOpen: boolean;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setDefaultView: (view: 'grid' | 'list') => void;
    setAutoCheckUpdates: (auto: boolean) => void;
    setSettingsOpen: (isOpen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            theme: 'system',
            defaultView: 'grid',
            autoCheckUpdates: true,
            isSettingsOpen: false,
            setTheme: (theme) => set({ theme }),
            setDefaultView: (defaultView) => set({ defaultView }),
            setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
            setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
        }),
        {
            name: 'gen-studio-settings',
        }
    )
);
