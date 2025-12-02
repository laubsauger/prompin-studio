import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexerService } from './services/IndexerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
  });

  // Initialize Indexer with a default path for testing (e.g. user's pictures)
  // In real app, this would be set via IPC from user selection
  const picturesPath = app.getPath('pictures');
  indexerService.setRootPath(picturesPath).catch(console.error);

  ipcMain.handle('get-assets', async () => {
    return indexerService.getAssets();
  });

  ipcMain.handle('update-asset-status', async (event, id, status) => {
    return indexerService.updateAssetStatus(id, status);
  });

  ipcMain.handle('get-sync-stats', async () => {
    return indexerService.getStats();
  });

  ipcMain.handle('trigger-resync', async () => {
    return indexerService.resync();
  });

  ipcMain.handle('add-comment', async (event, assetId, text, authorId) => {
    return indexerService.addComment(assetId, text, authorId);
  });

  ipcMain.handle('update-metadata', async (event, assetId, key, value) => {
    return indexerService.updateMetadata(assetId, key, value);
  });

  // and load the index.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
