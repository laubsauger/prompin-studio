import type { Asset } from '../types';


export interface UploadMetadata {
    project?: string;
    scene?: string;
    tags?: string[];
    description?: string;
    author?: string;
    targetPath?: string;
}

export const uploadService = {
    uploadFile: async (file: File, metadata: any): Promise<Asset> => {
        console.log('[UploadService] Uploading file:', file);

        // Use webUtils via preload to get the real path
        // Fallback to (file as any).path for older Electron versions or if webUtils fails
        let sourcePath: string;
        try {
            sourcePath = window.ipcRenderer.getPathForFile(file);
        } catch (e) {
            console.warn('[UploadService] getPathForFile failed, falling back to file.path:', e);
            sourcePath = (file as any).path;
        }

        console.log('[UploadService] Resolved source path:', sourcePath);

        if (!sourcePath) {
            console.error('[UploadService] Missing path for file:', file.name);
            throw new Error('File path not found. Are you running in Electron?');
        }

        // Call main process to ingest the file
        // We use window.ipcRenderer directly as it's exposed in preload
        if (!window.ipcRenderer) {
            throw new Error('ipcRenderer not found');
        }

        return await window.ipcRenderer.invoke('ingest-file', sourcePath, metadata);
    }
};
