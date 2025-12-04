import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { Asset } from '../../src/types.js';
import { AssetManager } from './AssetManager.js';
import { syncService } from './SyncService.js';

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
        return this.assetManager.getAssets(this.rootPath);
    }

    public updateAssetStatus(id: string, status: string, fromSync: boolean = false) {
        db.prepare('UPDATE assets SET status = ? WHERE id = ?').run(status, id);
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
    }

    public updateMetadata(assetId: string, key: string, value: any) {
        const asset = this.assetManager.getAsset(assetId);
        if (!asset) return;
        const metadata = { ...asset.metadata, [key]: value };
        this.updateAssetMetadata(assetId, metadata);
    }

    public updateAssetMetadata(id: string, metadata: any, fromSync: boolean = false) {
        db.prepare('UPDATE assets SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), id);

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
}

export const assetService = new AssetService();
