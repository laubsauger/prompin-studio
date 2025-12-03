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
                        console.error('ffprobe error:', err);
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
