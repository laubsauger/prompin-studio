import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settings';

describe('SettingsStore', () => {
    beforeEach(() => {
        useSettingsStore.setState({
            theme: 'system',
            defaultView: 'grid',
            autoCheckUpdates: true,
        });
    });

    it('should set theme', () => {
        const { setTheme } = useSettingsStore.getState();
        setTheme('dark');
        expect(useSettingsStore.getState().theme).toBe('dark');
    });

    it('should set default view', () => {
        const { setDefaultView } = useSettingsStore.getState();
        setDefaultView('list');
        expect(useSettingsStore.getState().defaultView).toBe('list');
    });

    it('should set auto check updates', () => {
        const { setAutoCheckUpdates } = useSettingsStore.getState();
        setAutoCheckUpdates(false);
        expect(useSettingsStore.getState().autoCheckUpdates).toBe(false);
    });
});
