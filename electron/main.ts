import { app, BrowserWindow, ipcMain, Menu, shell, dialog, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { indexerService } from './services/IndexerService.js';
import os from 'os';

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
    icon: path.join(process.env.VITE_PUBLIC || '', 'white_alpha.png'),
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
  // Register 'media' protocol to serve local files
  protocol.handle('media', async (request) => {
    let url = request.url.replace('media://', '');
    // Remove trailing slash if present
    url = url.replace(/\/$/, '');
    const decodedUrl = decodeURIComponent(url);

    try {
      let filePath: string;
      // If it looks like an absolute path (starts with / or drive letter), use it as is
      if (path.isAbsolute(decodedUrl) || (process.platform !== 'win32' && decodedUrl.startsWith('/'))) {
        filePath = decodedUrl;
      } else {
        // Otherwise resolve against root path
        const rootPath = indexerService.getRootPath();
        if (!rootPath) {
          console.warn('[Media Protocol] Root path not set, cannot resolve relative path:', decodedUrl);
          return new Response('Root path not set', { status: 404 });
        }
        // Join rootPath and decodedUrl, ensuring no double slashes if decodedUrl starts with /
        filePath = path.join(rootPath, decodedUrl.replace(/^\//, ''));
      }

      const fileUrl = pathToFileURL(filePath).toString();

      console.log(`[Media Protocol] Requesting: ${fileUrl}`);
      console.log(`[Media Protocol] Headers:`, JSON.stringify(Object.fromEntries(request.headers)));

      try {
        const response = await net.fetch(fileUrl, {
          method: request.method,
          headers: request.headers,
          bypassCustomProtocolHandlers: true
        });

        console.log(`[Media Protocol] Response status: ${response.status}`);
        console.log(`[Media Protocol] Response headers:`, JSON.stringify(Object.fromEntries(response.headers)));

        return response;
      } catch (error) {
        console.error(`[Media Protocol] Error fetching ${fileUrl}:`, error);
        throw error;
      }
    } catch (error) {
      console.error('[Media Protocol] Error:', error);
      return new Response('File not found', { status: 404 });
    }
  });

  // Register 'thumbnail' protocol
  protocol.handle('thumbnail', async (request) => {
    try {
      let url = request.url.replace('thumbnail://', '');
      // Remove trailing slash if present (browsers add this for standard protocols)
      url = url.replace(/\/$/, '');
      const filename = decodeURIComponent(url);

      // Use userData directory - same as IndexerService
      const thumbnailsPath = path.join(app.getPath('userData'), 'thumbnails');
      const filePath = path.join(thumbnailsPath, filename);

      console.log('[Thumbnail Protocol] Request URL:', request.url);
      console.log('[Thumbnail Protocol] Filename:', filename);
      console.log('[Thumbnail Protocol] Full path:', filePath);

      // Check if file exists
      const fs = await import('fs/promises');
      try {
        await fs.access(filePath);
        console.log('[Thumbnail Protocol] ✓ File exists!');
      } catch {
        console.error('[Thumbnail Protocol] ✗ File does not exist:', filePath);
        return new Response('Thumbnail not found', { status: 404 });
      }

      const fileUrl = pathToFileURL(filePath).toString();
      return net.fetch(fileUrl);
    } catch (error) {
      console.error('[Thumbnail Protocol] Error:', error);
      return new Response('Thumbnail error: ' + (error instanceof Error ? error.message : String(error)), { status: 500 });
    }
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

ipcMain.handle('show-confirm-dialog', async (event, options) => {
  const result = await dialog.showMessageBox(win!, {
    type: 'question',
    buttons: ['Cancel', 'OK'],
    defaultId: 1,
    cancelId: 0,
    title: options.title || 'Confirm',
    message: options.message,
    detail: options.detail,
    icon: path.join(process.env.VITE_PUBLIC || '', 'white_alpha.png'),
    ...options
  });
  return result.response === 1;
});

ipcMain.handle('set-root-path', async (event, path) => {
  console.log('[Main] set-root-path called with:', path);
  indexerService.setRootPath(path);
  return true;
});

ipcMain.handle('get-assets', async () => {
  return indexerService.getAssets();
});

ipcMain.handle('search-assets', async (event, searchQuery, filters) => {
  return indexerService.searchAssets(searchQuery, filters);
});

ipcMain.handle('get-lineage', async (event, assetId) => {
  return indexerService.getLineage(assetId);
});

ipcMain.handle('update-asset-status', async (event, id, status) => {
  return indexerService.updateAssetStatus(id, status);
});

ipcMain.handle('get-sync-stats', async () => {
  const stats = indexerService.getStats();
  console.log('[Main] get-sync-stats returning:', stats);
  return stats;
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

ipcMain.handle('update-asset-metadata', async (event, assetId, metadata) => {
  return indexerService.updateAssetMetadata(assetId, metadata);
});

ipcMain.handle('delete-tag', async (event, tagId) => {
  return indexerService.deleteTag(tagId);
});

ipcMain.handle('get-asset', async (event, assetId) => {
  return indexerService.getAsset(assetId);
});

ipcMain.handle('regenerate-thumbnails', async () => {
  return indexerService.regenerateThumbnails();
});

ipcMain.handle('get-folder-colors', async () => {
  return indexerService.getFolderColors();
});

ipcMain.handle('set-folder-color', async (event, path, color) => {
  return indexerService.setFolderColor(path, color);
});

// Tag IPC Handlers
ipcMain.handle('get-folders', () => {
  return indexerService.getFolders();
});

ipcMain.handle('get-tags', async () => {
  return indexerService.getTags();
});

ipcMain.handle('create-tag', async (event, name, color) => {
  return indexerService.createTag(name, color);
});

ipcMain.handle('delete-tag', async (event, id) => {
  return indexerService.deleteTag(id);
});

ipcMain.handle('add-tag-to-asset', async (event, assetId, tagId) => {
  return indexerService.addTagToAsset(assetId, tagId);
});

ipcMain.handle('remove-tag-from-asset', async (event, assetId, tagId) => {
  return indexerService.removeTagFromAsset(assetId, tagId);
});

ipcMain.handle('ingest-file', async (event, sourcePath, metadata) => {
  return indexerService.ingestFile(sourcePath, metadata);
});

ipcMain.handle('get-asset-tags', async (event, assetId) => {
  return indexerService.getAssetTags(assetId);
});

ipcMain.handle('get-current-user', async () => {
  const userInfo = os.userInfo();
  // Try to get full name from gecos field (on Unix-like systems)
  // Otherwise fall back to username
  const fullName = userInfo.username;
  return {
    username: userInfo.username,
    fullName: fullName
  };
});

ipcMain.handle('reveal-in-finder', async (event, relativePath) => {
  const rootPath = indexerService.getRootPath();
  if (!rootPath) return false;

  const fullPath = path.join(rootPath, relativePath);
  shell.showItemInFolder(fullPath);
  return true;
});
