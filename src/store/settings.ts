import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    theme: 'light' | 'dark' | 'system';
    defaultView: 'grid' | 'list';
    autoCheckUpdates: boolean;
    isSettingsOpen: boolean;
    rootFolder: string | null;
    gridSize: number;
    userName: string | null;
    userAvatar: string | null;
    scrollPositions: Record<string, number>; // path -> scroll position
    sidebarCollapsed: boolean;
    inspectorCollapsed: boolean;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setDefaultView: (view: 'grid' | 'list') => void;
    setAutoCheckUpdates: (auto: boolean) => void;
    setSettingsOpen: (isOpen: boolean) => void;
    setRootFolder: (path: string | null) => void;
    setGridSize: (size: number) => void;
    setUserName: (name: string | null) => void;
    setUserAvatar: (avatar: string | null) => void;
    setScrollPosition: (path: string, position: number) => void;
    getScrollPosition: (path: string) => number;
    toggleSidebar: () => void;
    toggleInspector: () => void;
    resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            theme: 'system',
            defaultView: 'grid',
            autoCheckUpdates: true,
            isSettingsOpen: false,
            rootFolder: null,
            gridSize: 300,
            userName: null,
            userAvatar: null,
            scrollPositions: {},
            sidebarCollapsed: false,
            inspectorCollapsed: false,
            setTheme: (theme) => set({ theme }),
            setDefaultView: (defaultView) => set({ defaultView }),
            setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
            setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
            setRootFolder: (rootFolder) => set({ rootFolder }),
            setGridSize: (gridSize) => set({ gridSize }),
            setUserName: (userName) => set({ userName }),
            setUserAvatar: (userAvatar) => set({ userAvatar }),
            setScrollPosition: (path, position) => set((state) => ({
                scrollPositions: { ...state.scrollPositions, [path]: position }
            })),
            getScrollPosition: (path) => get().scrollPositions[path] || 0,
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
            toggleInspector: () => set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed })),
            resetSettings: () => {
                localStorage.removeItem('prompin-studio-settings');
                localStorage.removeItem('prompin-studio-storage'); // Clear main store too if needed
                set({
                    theme: 'system',
                    defaultView: 'grid',
                    autoCheckUpdates: true,
                    isSettingsOpen: false,
                    rootFolder: null,
                    gridSize: 300,
                    userName: null,
                    userAvatar: null,
                    scrollPositions: {},
                    sidebarCollapsed: false,
                    inspectorCollapsed: false,
                });
                window.location.reload();
            },
        }),
        {
            name: 'prompin-studio-settings',
        }
    )
);
