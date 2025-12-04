import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { syncService } from './SyncService.js';

export class TagService {
    private isApplyingRemoteUpdate = false;

    constructor() {
        // Listen to sync events if needed, or let IndexerService handle incoming events
        // For now, IndexerService handles incoming events and calls methods here.
        // But we need to know if we are applying a remote update to avoid loops.
        // We can expose a method to set this flag or pass it as an argument.
        // Or better: IndexerService calls `handleRemoteTagCreate` which calls `createTag(..., true)`.
    }

    public getTags() {
        const stmt = db.prepare('SELECT * FROM tags ORDER BY name ASC');
        return stmt.all();
    }

    public createTag(name: string, color?: string, fromSync: boolean = false) {
        try {
            const id = uuidv4();
            const stmt = db.prepare('INSERT INTO tags (id, name, color) VALUES (@id, @name, @color)');
            stmt.run({ id, name, color: color || null });

            if (!fromSync) {
                syncService.publish('TAG_CREATE', { tag: { id, name, color } });
            }
            return { id, name, color };
        } catch (err: any) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as any;
                if (existing) return existing;
            }
            throw err;
        }
    }

    public deleteTag(id: string, fromSync: boolean = false) {
        db.prepare('DELETE FROM tags WHERE id = ?').run(id);
        if (!fromSync) {
            syncService.publish('TAG_DELETE', { id });
        }
    }

    public addTagToAsset(assetId: string, tagId: string, fromSync: boolean = false) {
        const stmt = db.prepare('INSERT OR IGNORE INTO asset_tags (assetId, tagId) VALUES (?, ?)');
        stmt.run(assetId, tagId);
        if (!fromSync) {
            syncService.publish('ASSET_TAG_ADD', { assetId, tagId });
        }
    }

    public removeTagFromAsset(assetId: string, tagId: string, fromSync: boolean = false) {
        db.prepare('DELETE FROM asset_tags WHERE assetId = ? AND tagId = ?').run(assetId, tagId);
        if (!fromSync) {
            syncService.publish('ASSET_TAG_REMOVE', { assetId, tagId });
        }
    }

    public getAssetTags(assetId: string) {
        const stmt = db.prepare(`
            SELECT t.* FROM tags t
            JOIN asset_tags at ON t.id = at.tagId
            WHERE at.assetId = ?
        `);
        return stmt.all(assetId);
    }
}

export const tagService = new TagService();
