// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { Asset } from '../../../src/types.js';
import { app, nativeImage } from 'electron';

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

        const ext = path.extname(filePath).toLowerCase();
        const isVideo = ['.mp4', '.mov', '.webm', '.mkv'].includes(ext);

        if (isVideo) {
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
                        if (!err.message?.includes('moov atom not found') && !err.message?.includes('Invalid data found')) {
                            console.warn(`[ThumbnailGenerator] Warning generating video thumbnail for ${path.basename(filePath)}:`, err.message);
                        }
                        resolve(undefined);
                    });
            });
        } else {
            // Image resizing
            try {
                // Yield to event loop before processing to avoid blocking
                await new Promise(r => setImmediate(r));

                // Check file size
                const stats = await fs.stat(filePath);
                if (stats.size === 0) {
                    console.warn(`[ThumbnailGenerator] Skipping empty file: ${path.basename(filePath)}`);
                    return undefined;
                }

                // Try nativeImage first
                let useFfmpeg = false;
                try {
                    const image = nativeImage.createFromPath(filePath);
                    if (!image.isEmpty()) {
                        const resized = image.resize({ width: 320 });
                        const buffer = resized.toJPEG(80);
                        await fs.writeFile(thumbnailPath, buffer);
                        return thumbnailFilename;
                    } else {
                        useFfmpeg = true;
                    }
                } catch (e) {
                    // nativeImage failed, fall back to ffmpeg
                    useFfmpeg = true;
                    // console.debug(`[ThumbnailGenerator] nativeImage failed for ${path.basename(filePath)}:`, e); // Optional: for debugging
                }

                if (useFfmpeg) {
                    // Fallback to ffmpeg
                    return new Promise((resolve) => {
                        ffmpeg(filePath)
                            .output(thumbnailPath)
                            .size('320x?')
                            .on('end', () => resolve(thumbnailFilename))
                            .on('error', (err: any) => {
                                if (err.message.includes('Invalid data found') || err.message.includes('Conversion failed')) {
                                    console.warn(`[ThumbnailGenerator] Skipping invalid/unsupported file: ${path.basename(filePath)}`);
                                } else {
                                    console.warn(`[ThumbnailGenerator] ffmpeg failed for ${path.basename(filePath)}:`, err.message);
                                }
                                resolve(undefined);
                            })
                            .run();
                    });
                }
            } catch (err) {
                console.warn(`[ThumbnailGenerator] Error generating image thumbnail for ${path.basename(filePath)}:`, err);
                return undefined;
            }
        }
    }

    public async processQueue(
        assets: Asset[],
        rootPath: string,
        onProgress: (progress: ThumbnailProgress, currentFile: string) => void,
        onComplete: (assetId: string, thumbnailPath: string) => void
    ) {
        const assetsNeedingThumbnails = assets.filter(a => (a.type === 'video' || a.type === 'image') && !a.thumbnailPath);
        let current = 0;
        const total = assetsNeedingThumbnails.length;

        onProgress({ current, total }, '');

        for (const asset of assetsNeedingThumbnails) {
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
            // Yield to allow UI updates
            await new Promise(r => setTimeout(r, 5));
        }

        onProgress({ current: total, total }, '');
    }
}
