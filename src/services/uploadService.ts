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
    uploadFile: async (file: File, metadata: UploadMetadata): Promise<Asset> => {
        // In Electron, File object has a path property containing the absolute path
        const sourcePath = (file as any).path;

        if (!sourcePath) {
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
