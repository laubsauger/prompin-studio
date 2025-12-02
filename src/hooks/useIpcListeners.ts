import { useEffect } from 'react';
import { useSettingsStore } from '../store/settings';

export const useIpcListeners = () => {
    const { setSettingsOpen } = useSettingsStore();

    useEffect(() => {
        const handleOpenSettings = () => setSettingsOpen(true);

        window.ipcRenderer?.on('open-settings', handleOpenSettings);

        return () => {
            window.ipcRenderer?.off('open-settings', handleOpenSettings);
        };
    }, [setSettingsOpen]);
};
