import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { Asset } from '../../src/types.js';
import { AssetManager } from './AssetManager.js';
import { syncService } from './SyncService.js';

import { analyticsService } from './AnalyticsService.js';

export class AssetService {
    private assetManager: AssetManager;
    private rootPath: string = '';

    constructor() {
        this.assetManager = new AssetManager();
    }

    public setRootPath(rootPath: string) {
        this.rootPath = rootPath;
    }

    public getAsset(id: string) {
        return this.assetManager.getAsset(id);
    }

    public getAssets() {
        const assets = this.assetManager.getAssets(this.rootPath);
        console.log(`[AssetService] getAssets for rootPath '${this.rootPath}' returning ${assets.length} assets`);
        if (assets.length === 0) {
            // Debug: Check if DB has ANY assets and what their rootPath is
            try {
                const anyAsset = db.prepare('SELECT rootPath, path FROM assets LIMIT 1').get() as { rootPath: string, path: string };
                if (anyAsset) {
                    console.log(`[AssetService] DEBUG: Found asset in DB with rootPath: '${anyAsset.rootPath}', path: '${anyAsset.path}'`);
                    console.log(`[AssetService] DEBUG: Current service rootPath: '${this.rootPath}'`);
                    console.log(`[AssetService] DEBUG: Match? ${anyAsset.rootPath === this.rootPath}`);
                } else {
                    console.log('[AssetService] DEBUG: DB is completely empty.');
                }
            } catch (e) {
                console.error('[AssetService] DEBUG: Failed to query DB:', e);
            }
        }
        return assets;
    }

    public updateAssetStatus(id: string, status: string, fromSync: boolean = false) {
        const asset = this.assetManager.getAsset(id);
        const oldStatus = asset?.status;

        db.prepare('UPDATE assets SET status = ? WHERE id = ?').run(status, id);

        // Log to history
        if (oldStatus !== status) {
            analyticsService.logEvent(id, 'update', 'status', oldStatus, status);
        }

        if (!fromSync) {
            syncService.publish('ASSET_UPDATE', { assetId: id, changes: { status } });
        }
    }

    public addComment(assetId: string, text: string, authorId: string) {
        const asset = this.assetManager.getAsset(assetId);
        if (!asset) return;
        const comments = asset.metadata.comments || [];
        comments.push({ id: uuidv4(), text, authorId, timestamp: Date.now() });
        this.updateAssetMetadata(assetId, { ...asset.metadata, comments });

        // Log comment as an update to metadata (or could be a separate action type if we wanted)
        analyticsService.logEvent(assetId, 'update', 'comments', null, 'comment added');
    }

    public updateMetadata(assetId: string, key: string, value: any) {
        const asset = this.assetManager.getAsset(assetId);
        if (!asset) return;
        const metadata = { ...asset.metadata, [key]: value };
        this.updateAssetMetadata(assetId, metadata);
    }

    public updateAssetMetadata(id: string, metadata: any, fromSync: boolean = false) {
        const asset = this.assetManager.getAsset(id);
        const oldMetadata = asset?.metadata;

        db.prepare('UPDATE assets SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), id);

        // Log significant metadata changes? 
        // For now, let's just log that metadata changed. 
        // Or we could diff keys. Let's diff keys for better granularity.
        if (oldMetadata) {
            const oldMetaAny = oldMetadata as any;
            const newMetaAny = metadata as any;
            for (const key in metadata) {
                if (JSON.stringify(newMetaAny[key]) !== JSON.stringify(oldMetaAny[key])) {
                    // Skip logging huge fields or internal ones if needed
                    if (key === 'embedding') continue;
                    analyticsService.logEvent(id, 'update', `metadata.${key}`, JSON.stringify(oldMetaAny[key]), JSON.stringify(newMetaAny[key]));
                }
            }
        }

        if (!fromSync) {
            // Filter out embedding to avoid syncing huge blobs
            const { embedding, ...syncMetadata } = metadata;
            syncService.publish('ASSET_UPDATE', { assetId: id, changes: { metadata: syncMetadata } });
        }

        // Manual FTS Update
        const row = db.prepare('SELECT rowid, path FROM assets WHERE id = ?').get(id) as { rowid: number, path: string };
        if (row) {
            db.prepare('DELETE FROM assets_fts WHERE rowid = ?').run(row.rowid);
            db.prepare('INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (?, ?, ?, ?)').run(row.rowid, id, row.path, JSON.stringify(metadata));
        }
    }

    public getLineage(id: string): Asset[] {
        const assets = new Map<string, Asset>();
        const visited = new Set<string>();

        // Helper to get asset by ID (synchronous since we have in-memory map)
        const getAsset = (assetId: string) => this.assetManager.getAsset(assetId);

        // Queue for BFS
        const queue: string[] = [id];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const asset = getAsset(currentId);
            if (!asset) continue;

            assets.set(asset.id, asset);

            // 1. Traverse Up (Ancestors) - inputs
            if (asset.metadata.inputs) {
                for (const inputId of asset.metadata.inputs) {
                    if (!visited.has(inputId)) {
                        queue.push(inputId);
                    }
                }
            }

            // 2. Traverse Down (Descendants) - assets that have this as input
            // This is expensive if we iterate all assets every time.
            // Ideally we'd have a reverse index. For now, we'll iterate all assets once to build a map?
            // Or just iterate all assets for the current node?
            // Let's iterate all assets to find children.
            // Optimization: Build a reverse index on startup/update?
            // For now, simple iteration.
            const allAssets = this.assetManager.getAssets(this.rootPath);
            for (const otherAsset of allAssets) {
                if (otherAsset.metadata.inputs?.includes(currentId)) {
                    if (!visited.has(otherAsset.id)) {
                        queue.push(otherAsset.id);
                    }
                }
            }
        }

        return Array.from(assets.values());
    }
    public deleteAsset(id: string) {
        const asset = this.assetManager.getAsset(id);
        if (!asset) return;

        // Log to history before deleting (so we have record of who deleted it and when)
        analyticsService.logEvent(id, 'delete', undefined, undefined, undefined);

        // Delete from DB
        db.prepare('DELETE FROM assets WHERE id = ?').run(id);
        db.prepare('DELETE FROM assets_fts WHERE id = ?').run(id);
        db.prepare('DELETE FROM asset_tags WHERE assetId = ?').run(id);
        // Note: asset_history has ON DELETE CASCADE, so history will be deleted?
        // Wait, if we delete the asset, the history might be deleted if we have foreign key constraint with cascade.
        // Let's check db.ts.

        // If we want to keep audit trail of deleted assets, we should NOT cascade delete history,
        // OR we should keep a separate "deleted_assets" log, or just soft delete.
        // The user asked for "Audit trail", usually implies keeping history even after delete.
        // But if I delete the asset row, and history references it...
        // In db.ts: FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
        // So history WILL be deleted.

        // I should probably change the schema to NOT cascade, or allow NULL assetId, or soft delete.
        // For now, to fulfill the requirement "Audit trail", I should probably NOT delete the history.
        // But if I don't delete history, I have a foreign key violation if I delete the asset.

        // Solution: Soft delete the asset? Or change schema to set assetId to NULL?
        // Or maybe just keep the history in a separate table that doesn't enforce FK?
        // The current schema enforces FK.

        // Let's modify `db.ts` to remove ON DELETE CASCADE or make it ON DELETE SET NULL?
        // If I make it SET NULL, I lose the link to the asset ID string if I'm not careful.
        // Actually, if I delete the asset, `assetId` in history is just a string. 
        // SQLite FKs: if I delete parent, and child has ON DELETE CASCADE, child is deleted.

        // I should change `db.ts` to NOT cascade, and maybe remove the FK constraint or make it deferred?
        // Or better: Soft delete assets. `status = 'deleted'`.
        // The user didn't explicitly ask for soft delete, but it's best practice for audit trails.

        // However, if I really want to delete, I should probably store the history elsewhere or accept it's gone.
        // But "Audit trail" usually means "who deleted this?". If the history is gone, we don't know.

        // Let's try to Soft Delete first.
        // But `deleteAsset` implies removal.

        // If I change the FK to ON DELETE NO ACTION (default), then I can't delete the asset if history exists.

        // I'll stick to the plan: Implement `deleteAsset` which performs a hard delete for now, 
        // BUT I will change the schema to NOT cascade delete, so we keep the history.
        // Wait, if I keep history, `assetId` still points to a non-existent asset. 
        // SQLite allows this if FK is not enforced or if I drop the FK.

        // Let's check `db.ts` again.
    }

    public getMetadataOptions() {
        // Query distinct values for each field from the JSON metadata column
        // We use json_extract to get the values
        const authors = db.prepare("SELECT DISTINCT json_extract(metadata, '$.authorId') as val FROM assets WHERE val IS NOT NULL AND val != '' ORDER BY val").all() as { val: string }[];
        const projects = db.prepare("SELECT DISTINCT json_extract(metadata, '$.project') as val FROM assets WHERE val IS NOT NULL AND val != '' ORDER BY val").all() as { val: string }[];
        const scenes = db.prepare("SELECT DISTINCT json_extract(metadata, '$.scene') as val FROM assets WHERE val IS NOT NULL AND val != '' ORDER BY val").all() as { val: string }[];
        const shots = db.prepare("SELECT DISTINCT json_extract(metadata, '$.shot') as val FROM assets WHERE val IS NOT NULL AND val != '' ORDER BY val").all() as { val: string }[];
        const models = db.prepare("SELECT DISTINCT json_extract(metadata, '$.model') as val FROM assets WHERE val IS NOT NULL AND val != '' ORDER BY val").all() as { val: string }[];

        return {
            authors: authors.map(r => r.val),
            projects: projects.map(r => r.val),
            scenes: scenes.map(r => r.val),
            shots: shots.map(r => r.val),
            models: models.map(r => r.val)
        };
    }
}

export const assetService = new AssetService();
