import { useEffect } from 'react';
import { useSettingsStore } from '../store/settings';
import { useStore } from '../store';

export const useIpcListeners = () => {
    const { setSettingsOpen } = useSettingsStore();

    useEffect(() => {
        const handleOpenSettings = () => setSettingsOpen(true);
        const handleAssetUpdated = (_event: any, asset: any) => {
            useStore.getState().onAssetUpdated(asset);
        };

        window.ipcRenderer?.on('open-settings', handleOpenSettings);
        window.ipcRenderer?.on('asset-updated', handleAssetUpdated);

        return () => {
            window.ipcRenderer?.off('open-settings', handleOpenSettings);
            window.ipcRenderer?.off('asset-updated', handleAssetUpdated);
        };
    }, [setSettingsOpen]);
};
