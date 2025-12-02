import { app, BrowserWindow, ipcMain, Menu, shell, dialog, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexerService } from './services/IndexerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
  });

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: any[] = [
    ...(isMac
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: 'Settings...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              win?.webContents.send('open-settings');
            }
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }]
      : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ]
          : [
            { role: 'close' }
          ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://electronjs.org');
          }
        },
        {
          label: 'Check for Updates...',
          click: async () => {
            win?.webContents.send('check-for-updates');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Register custom protocol privileges
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } },
  { scheme: 'thumbnail', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

app.whenReady().then(() => {
  // Register 'media' protocol to serve local files
  protocol.handle('media', (request) => {
    const url = request.url.replace('media://', '');
    const decodedUrl = decodeURIComponent(url);

    try {
      let fileUrl: string;
      // If it looks like an absolute path (starts with / or drive letter), use it as is
      if (path.isAbsolute(decodedUrl) || decodedUrl.startsWith('/')) {
        fileUrl = 'file://' + (decodedUrl.startsWith('/') ? '' : '/') + decodedUrl;
      } else {
        // Otherwise resolve against root path
        const rootPath = indexerService.getRootPath();
        if (!rootPath) throw new Error('Root path not set');
        const absolutePath = path.join(rootPath, decodedUrl);
        fileUrl = 'file://' + absolutePath;
      }

      return net.fetch(fileUrl);
    } catch (error) {
      console.error('[Media Protocol] Error:', error);
      return new Response('Error loading media', { status: 500 });
    }
  });

  // Register 'thumbnail' protocol
  protocol.handle('thumbnail', (request) => {
    const url = request.url.replace('thumbnail://', '');
    const filename = decodeURIComponent(url);
    const thumbnailsPath = path.join(process.env.APP_ROOT || app.getPath('userData'), 'thumbnails');
    const filePath = path.join(thumbnailsPath, filename);
    return net.fetch('file://' + filePath);
  });

  createMenu();
  createWindow();
});

// IPC Handlers
ipcMain.handle('open-directory-dialog', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('set-root-path', async (event, path) => {
  indexerService.setRootPath(path);
  return true;
});

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
