import { useEffect } from 'react';
import { Explorer } from './components/Explorer';
import { SyncStatus } from './components/SyncStatus';
import { DragDropOverlay } from './components/DragDropOverlay';
import { IngestionModal } from './components/IngestionModal';
import { SetupScreen } from './components/SetupScreen';
import { useSettingsStore } from './store/settings';

import './App.css';

function App() {
  const rootFolder = useSettingsStore(state => state.rootFolder);
  const theme = useSettingsStore(state => state.theme);

  // Handle Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Initialize root path on mount if it exists
  useEffect(() => {
    if (rootFolder) {
      // We need a way to just set the path without opening dialog
      // Since I didn't add a separate action for that, let's just invoke IPC directly here for now
      // or add another action. Direct IPC is fine for initialization.
      const ipc = (window as any).ipcRenderer;
      if (ipc) {
        ipc.invoke('set-root-path', rootFolder).catch(console.error);
      }
    }
  }, [rootFolder]);

  if (!rootFolder) {
    return <SetupScreen />;
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground">
      <Explorer />
      <SyncStatus />
      <DragDropOverlay />
      <IngestionModal />
    </div>
  );
}

export default App;
