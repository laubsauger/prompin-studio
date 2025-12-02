import type { Asset } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Determine path
        let uploadPath = '';
        if (metadata.targetPath) {
            uploadPath = `${metadata.targetPath}/${file.name}`;
        } else {
            uploadPath = `uploads/${metadata.project || 'default'}/${file.name}`;
        }

        // Mock asset creation
        // In a real app, this would be returned by the backend after upload
        const newAsset: Asset = {
            id: uuidv4(),
            path: uploadPath,
            type: file.type.startsWith('video') ? 'video' : 'image',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: {
                width: 1920, // Mock dimensions
                height: 1080,
                project: metadata.project,
                scene: metadata.scene,
                description: metadata.description,
                author: metadata.author,
                // In a real app, we might store the Drive ID or URL here
                // driveId: 'mock-drive-id',
            }
        };

        return newAsset;
    }
};
