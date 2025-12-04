import db from '../../db.js';
import { Asset } from '../../../src/types.js';
import path from 'path';

export class AssetManager {
    public getAssets(rootPath: string): Asset[] {
        const stmt = db.prepare('SELECT * FROM assets WHERE rootPath = ? ORDER BY createdAt DESC');
        const assets = stmt.all(rootPath).map((row: any) => ({
            ...row,
            metadata: JSON.parse(row.metadata)
        }));

        if (assets.length === 0) return [];

        const assetIds = assets.map((a: any) => a.id);
        const placeholders = assetIds.map(() => '?').join(', ');

        const tagsStmt = db.prepare(`
            SELECT at.assetId, t.id, t.name, t.color
            FROM asset_tags at
            JOIN tags t ON at.tagId = t.id
            WHERE at.assetId IN (${placeholders})
        `);
        const allTags = tagsStmt.all(...assetIds) as { assetId: string; id: string; name: string; color: string }[];

        const tagsByAsset: Record<string, any[]> = {};
        for (const tag of allTags) {
            if (!tagsByAsset[tag.assetId]) {
                tagsByAsset[tag.assetId] = [];
            }
            tagsByAsset[tag.assetId].push({ id: tag.id, name: tag.name, color: tag.color });
        }

        return assets.map((asset: any) => ({
            ...asset,
            tags: tagsByAsset[asset.id] || []
        }));
    }

    public getAsset(id: string): Asset | undefined {
        const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as any;
        if (!row) return undefined;

        const asset = {
            ...row,
            metadata: JSON.parse(row.metadata)
        };

        // Fetch tags
        const tags = db.prepare(`
            SELECT t.* FROM tags t
            JOIN asset_tags at ON t.id = at.tagId
            WHERE at.assetId = ?
        `).all(id);

        return { ...asset, tags };
    }

    public upsertAsset(asset: Asset) {
        const existing = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset.id);

        if (existing) {
            db.prepare(`
                UPDATE assets 
                SET path = @path, 
                    rootPath = @rootPath,
                    type = @type,
                    updatedAt = @updatedAt, 
                    status = @status, 
                    metadata = @metadata,
                    thumbnailPath = @thumbnailPath
                WHERE id = @id
            `).run({
                ...asset,
                metadata: JSON.stringify(asset.metadata)
            });

            // Manual FTS Update
            const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(asset.id) as { rowid: number };
            if (row) {
                db.prepare('DELETE FROM assets_fts WHERE rowid = ?').run(row.rowid);
                db.prepare('INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (?, ?, ?, ?)').run(row.rowid, asset.id, asset.path, JSON.stringify(asset.metadata));
            }

        } else {
            try {
                db.prepare(`
                    INSERT INTO assets (id, path, rootPath, type, createdAt, updatedAt, status, metadata, thumbnailPath)
                    VALUES (@id, @path, @rootPath, @type, @createdAt, @updatedAt, @status, @metadata, @thumbnailPath)
                `).run({
                    ...asset,
                    metadata: JSON.stringify(asset.metadata)
                });

                // Manual FTS Insert
                const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(asset.id) as { rowid: number };
                if (row) {
                    db.prepare('INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (?, ?, ?, ?)').run(row.rowid, asset.id, asset.path, JSON.stringify(asset.metadata));
                }

            } catch (error: any) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    // Handle collision by updating existing record at that path
                    const updateStmt = db.prepare(`
                        UPDATE assets 
                        SET id = @id,
                            type = @type,
                            updatedAt = @updatedAt,
                            status = @status,
                            metadata = @metadata,
                            thumbnailPath = @thumbnailPath
                        WHERE rootPath = @rootPath AND path = @path
                    `);
                    updateStmt.run({
                        ...asset,
                        metadata: JSON.stringify(asset.metadata)
                    });

                    // Manual FTS Update
                    const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(asset.id) as { rowid: number };
                    if (row) {
                        db.prepare('DELETE FROM assets_fts WHERE rowid = ?').run(row.rowid);
                        db.prepare('INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (?, ?, ?, ?)').run(row.rowid, asset.id, asset.path, JSON.stringify(asset.metadata));
                    }
                } else {
                    throw error;
                }
            }
        }
    }

    public updateThumbnail(id: string, thumbnailPath: string) {
        db.prepare('UPDATE assets SET thumbnailPath = ? WHERE id = ?').run(thumbnailPath, id);
    }

    public rehomeAssets(newRootPath: string) {
        try {
            const allAssets = db.prepare('SELECT id, rootPath, path FROM assets').all() as { id: string; rootPath: string; path: string }[];
            const updates: { id: string; rootPath: string; path: string }[] = [];

            for (const asset of allAssets) {
                const absolutePath = path.join(asset.rootPath, asset.path);
                const isWithin = absolutePath === newRootPath || absolutePath.startsWith(newRootPath + path.sep);

                if (isWithin) {
                    const newRelativePath = path.relative(newRootPath, absolutePath);
                    if (asset.rootPath !== newRootPath || asset.path !== newRelativePath) {
                        updates.push({
                            id: asset.id,
                            rootPath: newRootPath,
                            path: newRelativePath
                        });
                    }
                }
            }

            if (updates.length > 0) {
                const stmt = db.prepare('UPDATE assets SET rootPath = @rootPath, path = @path WHERE id = @id');
                const deleteStmt = db.prepare('DELETE FROM assets WHERE id = ?');
                const checkStmt = db.prepare('SELECT id FROM assets WHERE rootPath = ? AND path = ?');

                const updateTransaction = db.transaction((assetsToUpdate: any[]) => {
                    for (const update of assetsToUpdate) {
                        // Check for conflict
                        const existing = checkStmt.get(update.rootPath, update.path) as { id: string };
                        if (existing && existing.id !== update.id) {
                            // Conflict! Delete the existing one to allow the move
                            deleteStmt.run(existing.id);
                            // FTS delete handled by trigger (we kept delete trigger)
                        }
                        stmt.run(update);

                        // Manual FTS Update for re-homed asset
                        const row = db.prepare('SELECT rowid FROM assets WHERE id = ?').get(update.id) as { rowid: number };
                        if (row) {
                            // We need to fetch metadata to update FTS fully, or just update path?
                            // FTS5 doesn't support partial updates easily without content=assets.
                            // We need to delete and re-insert.
                            const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(update.id) as any;
                            if (asset) {
                                db.prepare('DELETE FROM assets_fts WHERE rowid = ?').run(row.rowid);
                                db.prepare('INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (?, ?, ?, ?)').run(row.rowid, asset.id, asset.path, asset.metadata);
                            }
                        }
                    }
                });
                updateTransaction(updates);
            }
        } catch (error) {
            console.error('[AssetManager] Failed to re-home assets:', error);
        }
    }

    // ... searchAssets implementation would go here (omitted for brevity, can be copied from IndexerService if needed or kept in IndexerService for now)
}
