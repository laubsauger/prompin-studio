import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    theme: 'light' | 'dark' | 'system';
    defaultView: 'grid' | 'list';
    autoCheckUpdates: boolean;
    isSettingsOpen: boolean;
    rootFolder: string | null;
    gridSize: number;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setDefaultView: (view: 'grid' | 'list') => void;
    setAutoCheckUpdates: (auto: boolean) => void;
    setSettingsOpen: (isOpen: boolean) => void;
    setRootFolder: (path: string | null) => void;
    setGridSize: (size: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            theme: 'system',
            defaultView: 'grid',
            autoCheckUpdates: true,
            isSettingsOpen: false,
            rootFolder: null,
            gridSize: 300,
            setTheme: (theme) => set({ theme }),
            setDefaultView: (defaultView) => set({ defaultView }),
            setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
            setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
            setRootFolder: (rootFolder) => set({ rootFolder }),
            setGridSize: (gridSize) => set({ gridSize }),
        }),
        {
            name: 'gen-studio-settings',
        }
    )
);
