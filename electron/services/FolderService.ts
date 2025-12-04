import path from 'path';
import db from '../db.js';

export class FolderService {
    private rootPath: string = '';

    constructor() { }

    public setRootPath(rootPath: string) {
        this.rootPath = rootPath;
    }

    public getFolderColors(): Record<string, string> {
        const stmt = db.prepare('SELECT path, color FROM folders WHERE color IS NOT NULL');
        const rows = stmt.all() as { path: string; color: string }[];
        return rows.reduce((acc, row) => {
            acc[row.path] = row.color;
            return acc;
        }, {} as Record<string, string>);
    }

    public setFolderColor(folderPath: string, color: string | null) {
        if (color === null) {
            const stmt = db.prepare('UPDATE folders SET color = NULL WHERE path = ?');
            stmt.run(folderPath);
        } else {
            const stmt = db.prepare(`
                INSERT INTO folders (path, color) VALUES (?, ?)
                ON CONFLICT(path) DO UPDATE SET color = excluded.color
            `);
            stmt.run(folderPath, color);
        }
    }

    public getFolders(): string[] {
        if (!this.rootPath) return [];
        const stmt = db.prepare('SELECT DISTINCT path FROM assets WHERE rootPath = ?');
        const paths = stmt.all(this.rootPath) as { path: string }[];
        const folders = new Set<string>();

        paths.forEach(p => {
            const dir = path.dirname(p.path);
            if (dir !== '.') {
                let current = dir;
                while (current !== '.' && current !== '') {
                    folders.add(current);
                    current = path.dirname(current);
                }
            }
        });

        return Array.from(folders).sort();
    }
}

export const folderService = new FolderService();
