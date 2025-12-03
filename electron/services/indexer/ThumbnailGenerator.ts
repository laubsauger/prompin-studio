// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { Asset } from '../../../src/types.js';

export interface ThumbnailProgress {
    current: number;
    total: number;
}

export class ThumbnailGenerator {
    constructor(private thumbnailCachePath: string) { }

    public async generate(filePath: string, assetId: string, force: boolean = false): Promise<string | undefined> {
        const thumbnailFilename = `${assetId}.jpg`;
        const thumbnailPath = path.join(this.thumbnailCachePath, thumbnailFilename);

        try {
            const stats = await fs.stat(thumbnailPath);
            if (!force && stats.size > 0) return thumbnailFilename;
        } catch {
            // File doesn't exist
        }

        return new Promise((resolve) => {
            ffmpeg(filePath)
                .screenshots({
                    count: 1,
                    folder: this.thumbnailCachePath,
                    filename: thumbnailFilename,
                    size: '320x?'
                })
                .on('end', () => resolve(thumbnailFilename))
                .on('error', (err: any) => {
                    console.error('Thumbnail generation failed:', err);
                    resolve(undefined);
                });
        });
    }

    public async processQueue(
        assets: Asset[],
        rootPath: string,
        onProgress: (progress: ThumbnailProgress, currentFile: string) => void,
        onComplete: (assetId: string, thumbnailPath: string) => void
    ) {
        const videosNeedingThumbnails = assets.filter(a => a.type === 'video' && !a.thumbnailPath);
        let current = 0;
        const total = videosNeedingThumbnails.length;

        onProgress({ current, total }, '');

        for (const asset of videosNeedingThumbnails) {
            const fullPath = path.join(rootPath, asset.path);
            onProgress({ current: current + 1, total }, `Generating thumbnail: ${asset.path}`);

            try {
                const thumbnailPath = await this.generate(fullPath, asset.id);
                if (thumbnailPath) {
                    onComplete(asset.id, thumbnailPath);
                }
            } catch (err) {
                console.error(`Failed to generate thumbnail for ${asset.path}:`, err);
            }
            current++;
        }

        onProgress({ current: total, total }, '');
    }
}
