// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

export class MetadataExtractor {
    public async extract(filePath: string, mediaType: string, fileSize: number): Promise<any> {
        const metadata: any = {
            fileSize
        };

        if (mediaType === 'video') {
            return new Promise((resolve) => {
                ffmpeg.ffprobe(filePath, (err: any, data: any) => {
                    if (err) {
                        // Suppress verbose logging for expected errors on non-video files or partial downloads
                        if (!err.message?.includes('moov atom not found') && !err.message?.includes('Invalid data found')) {
                            console.warn(`[MetadataExtractor] Warning probing ${path.basename(filePath)}:`, err.message);
                        }
                        resolve(metadata);
                        return;
                    }

                    const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
                    if (videoStream) {
                        metadata.width = videoStream.width;
                        metadata.height = videoStream.height;
                        metadata.duration = data.format?.duration;
                    }

                    resolve(metadata);
                });
            });
        } else if (mediaType === 'image') {
            try {
                return new Promise((resolve) => {
                    ffmpeg.ffprobe(filePath, (err: any, data: any) => {
                        if (err) {
                            resolve(metadata);
                            return;
                        }

                        const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
                        if (videoStream) {
                            metadata.width = videoStream.width;
                            metadata.height = videoStream.height;
                        }

                        resolve(metadata);
                    });
                });
            } catch (err) {
                console.error('Error extracting image metadata:', err);
                return metadata;
            }
        }

        return metadata;
    }
}
