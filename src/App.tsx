import { useEffect } from 'react';
import { Explorer } from './components/Explorer';
import { DragDropOverlay } from './components/DragDropOverlay';
import { IngestionModal } from './components/IngestionModal';
import { SetupScreen } from './components/SetupScreen';
import { useSettingsStore } from './store/settings';

import './App.css';

import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';

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
      window.ipcRenderer?.invoke('set-root-path', rootFolder);

      // Load initial data
      import('./store').then(({ useStore }) => {
        useStore.getState().loadFolderColors();
        useStore.getState().loadTags();
        useStore.getState().loadAssets();
      });
    }
  }, [rootFolder]);

  if (!rootFolder) {
    return <SetupScreen />;
  }

  return (
    <>
      <TitleBar />
      <div className="h-[calc(100vh-40px)] flex bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden relative">
            <Explorer />
          </div>
        </div>
      </div>
      <DragDropOverlay />
      <IngestionModal />
    </>
  );
}

export default App;
