import type { Asset } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface UploadMetadata {
    project?: string;
    scene?: string;
    tags?: string[];
}

export const uploadService = {
    uploadFile: async (file: File, metadata: UploadMetadata): Promise<Asset> => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock asset creation
        // In a real app, this would be returned by the backend after upload
        const newAsset: Asset = {
            id: uuidv4(),
            path: `uploads/${metadata.project || 'default'}/${file.name}`,
            type: file.type.startsWith('video') ? 'video' : 'image',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: {
                width: 1920, // Mock dimensions
                height: 1080,
                project: metadata.project,
                scene: metadata.scene,
                // In a real app, we might store the Drive ID or URL here
                // driveId: 'mock-drive-id',
            }
        };

        return newAsset;
    }
};
