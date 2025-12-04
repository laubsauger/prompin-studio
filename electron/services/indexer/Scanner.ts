import fs from 'fs/promises';
import path from 'path';

export interface ScanStats {
    totalFiles: number;
    totalFolders: number;
    skippedFiles: number;
    images: number;
    videos: number;
    other: number;
}

export class Scanner {
    private stats: ScanStats = {
        totalFiles: 0,
        totalFolders: 0,
        skippedFiles: 0,
        images: 0,
        videos: 0,
        other: 0
    };

    constructor(private isMediaFile: (filePath: string) => boolean) { }

    public resetStats() {
        this.stats = {
            totalFiles: 0,
            totalFolders: 0,
            skippedFiles: 0,
            images: 0,
            videos: 0,
            other: 0
        };
    }

    public getStats(): ScanStats {
        return { ...this.stats };
    }

    public async preScan(dirPath: string) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.name.startsWith('.')) continue; // Skip dotfiles

                if (entry.isDirectory()) {
                    this.stats.totalFolders++;
                    await this.preScan(fullPath);
                } else if (entry.isFile()) {
                    if (this.isMediaFile(fullPath)) {
                        this.stats.totalFiles++;
                        const ext = path.extname(fullPath).toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                            this.stats.images++;
                        } else if (['.mp4', '.mov'].includes(ext)) {
                            this.stats.videos++;
                        } else {
                            this.stats.other++;
                        }
                    } else {
                        this.stats.skippedFiles++;
                    }
                }
            }
        } catch (error) {
            console.error(`[Scanner] Error pre-scanning directory ${dirPath}:`, error);
        }
    }

    public async scanDirectory(dirPath: string, onFileFound: (filePath: string) => Promise<void>) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.name.startsWith('.')) continue; // Skip dotfiles

                if (entry.isDirectory()) {
                    await this.scanDirectory(fullPath, onFileFound);
                } else if (entry.isFile()) {
                    await onFileFound(fullPath);
                } else if (entry.isSymbolicLink()) {
                    // Handle Symlinks:
                    // Instead of resolving the real path and passing that (which might be outside root),
                    // we pass the symlink path itself. The IndexerService will treat it as a file
                    // at this location.
                    // We verify it points to a file or directory we care about.
                    try {
                        const realPath = await fs.realpath(fullPath);
                        const stat = await fs.stat(realPath);
                        if (stat.isDirectory()) {
                            await this.scanDirectory(realPath, onFileFound);
                        } else if (stat.isFile()) {
                            // Pass the SYMLINK path, not the real path
                            await onFileFound(fullPath);
                        }
                    } catch (e) {
                        console.warn(`[Scanner] Failed to resolve symlink ${fullPath}:`, e);
                    }
                }
            }
        } catch (error) {
            console.error(`[Scanner] Error scanning directory ${dirPath}:`, error);
        }
    }
}
