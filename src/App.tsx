import { useEffect, useRef } from 'react';
import { Explorer } from './components/Explorer';
import { DragDropOverlay } from './components/DragDropOverlay';
import { IngestionModal } from './components/IngestionModal';
import { SetupScreen } from './components/SetupScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { LineageView } from './components/LineageView';
import { useSettingsStore } from './store/settings';
import { useStore } from './store';

import './App.css';

import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';

function App() {
  const rootFolder = useSettingsStore(state => state.rootFolder);
  const theme = useSettingsStore(state => state.theme);
  const isLoading = useStore(state => state.isLoading);
  const loadingMessage = useStore(state => state.loadingMessage);
  const syncStats = useStore(state => state.syncStats);

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
  const initializedRoot = useRef<string | null>(null);

  useEffect(() => {
    if (rootFolder && initializedRoot.current !== rootFolder) {
      initializedRoot.current = rootFolder;

      // We need a way to just set the path without opening dialog
      // Since I didn't add a separate action for that, let's just invoke IPC directly here for now
      // or add another action. Direct IPC is fine for initialization.
      window.ipcRenderer?.invoke('set-root-path', rootFolder);

      // Load initial data
      import('./store').then(({ useStore }) => {
        useStore.getState().initStore();
      });
    }
  }, [rootFolder]);

  if (!rootFolder) {
    return <SetupScreen />;
  }

  // Calculate loading progress from sync stats
  const loadingProgress = syncStats && syncStats.status === 'scanning' && syncStats.totalFiles > 0
    ? (syncStats.processedFiles / syncStats.totalFiles) * 100
    : undefined;

  const loadingDetails = syncStats && syncStats.status === 'scanning'
    ? `Processing ${syncStats.processedFiles || 0} of ${syncStats.totalFiles || 0} files`
    : undefined;

  // Extract file type counts from sync stats
  const imageCount = syncStats?.filesByType?.images;
  const videoCount = syncStats?.filesByType?.videos;
  const otherCount = syncStats?.filesByType?.other;
  const folderCount = syncStats?.totalFolders;

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
      <DragDropOverlay />
      <IngestionModal />
      <LineageView />

      {/* Loading Screen */}
      {(isLoading || syncStats?.status === 'scanning') && (
        <LoadingScreen
          message={loadingMessage || 'Scanning folder'}
          progress={loadingProgress}
          details={loadingMessage ? undefined : rootFolder}
          subDetails={loadingDetails}
          totalFiles={syncStats?.totalFiles}
          imageCount={imageCount}
          videoCount={videoCount}
          folderCount={folderCount}
          otherCount={otherCount}
        />
      )}
    </>
  );
}

export default App;
