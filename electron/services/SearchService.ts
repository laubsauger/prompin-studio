import db, { vectorSearchEnabled } from '../db.js';
import { Asset } from '../../src/types.js';
import { AssetManager } from './AssetManager.js';
import { embeddingService } from './indexer/EmbeddingService.js';

export class SearchService {
    private assetManager: AssetManager;
    private rootPath: string = '';

    constructor() {
        this.assetManager = new AssetManager();
    }

    public setRootPath(rootPath: string) {
        this.rootPath = rootPath;
    }

    public async findSimilar(assetId: string, limit: number = 20): Promise<Asset[]> {
        if (!vectorSearchEnabled) return [];
        const asset = this.assetManager.getAsset(assetId);
        if (!asset) {
            console.log(`[SearchService] findSimilar: Source asset ${assetId} not found`);
            return [];
        }
        if (!asset.metadata.embedding) {
            console.log(`[SearchService] findSimilar: Source asset ${assetId} has no embedding`);
            return [];
        }

        try {
            const embedding = JSON.stringify(asset.metadata.embedding);
            console.log(`[SearchService] findSimilar: Searching for ${asset.path} (embedding length: ${asset.metadata.embedding.length})`);



            const stmt = db.prepare(`
                WITH matches AS (
                    SELECT rowid, distance 
                    FROM vec_assets 
                    WHERE embedding MATCH ?
                    ORDER BY distance
                    LIMIT ?
                )
                SELECT a.*, m.distance 
                FROM matches m
                JOIN assets a ON a.rowid = m.rowid
                WHERE a.id != ? -- Exclude self
                ORDER BY m.distance ASC
            `);

            const results = stmt.all(embedding, limit + 1, assetId) as any[];
            console.log(`[SearchService] findSimilar: Found ${results.length} results`);

            return results.map(row => ({
                ...row,
                metadata: JSON.parse(row.metadata)
            }));
        } catch (error) {
            console.error('[SearchService] findSimilar failed:', error);
            return [];
        }
    }

    public async searchAssets(searchQuery: string, filters?: any): Promise<Asset[]> {
        let sql = `SELECT DISTINCT a.* FROM assets a`;
        let similarAssetsMap: Map<string, number> | undefined;
        const params: any = { rootPath: this.rootPath };
        const conditions: string[] = ['a.rootPath = @rootPath'];

        // 1. FTS Search
        if (searchQuery && searchQuery.trim() !== '') {
            // Standard FTS setup
            sql += ` JOIN assets_fts ON assets_fts.id = a.id`;
            conditions.push(`assets_fts MATCH @searchQuery`);
            params.searchQuery = searchQuery.split(' ').map(term => term + '*').join(' ');
        }

        // Apply filters to FTS query
        if (filters?.tagIds && filters.tagIds.length > 0) {
            conditions.push(`EXISTS (SELECT 1 FROM asset_tags at WHERE at.assetId = a.id AND at.tagId IN (${filters.tagIds.map((_: any, i: number) => `@tagId${i}`).join(',')}))`);
            filters.tagIds.forEach((tagId: string, i: number) => { params[`tagId${i}`] = tagId; });
        }
        if (filters?.ids && filters.ids.length > 0) {
            conditions.push(`a.id IN (${filters.ids.map((_: any, i: number) => `@id${i}`).join(',')})`);
            filters.ids.forEach((id: string, i: number) => { params[`id${i}`] = id; });
        }

        if (filters?.relatedToAssetId) {
            if (filters.semantic) {
                // Use vector search
                const similarAssets = await this.findSimilar(filters.relatedToAssetId, 50);

                if (similarAssets.length > 0) {
                    similarAssetsMap = new Map(similarAssets.map(a => [a.id, (a as any).distance]));

                    const similarIds = similarAssets.map(a => a.id);
                    conditions.push(`a.id IN (${similarIds.map((_, i) => `@simId${i}`).join(',')})`);
                    similarIds.forEach((id, i) => { params[`simId${i}`] = id; });
                } else {
                    // No similar assets found, but we will still show the source asset later
                    // so we ensure the query returns nothing initially (false condition) unless we add source later
                    // Actually, if we just want to show source, we can make the condition false OR rely on the append logic
                    // logic below appends based on JS array, but the initial SQL query needs to fetch something? via IDs?
                    // if conditions has "a.id IN ()" with empty list it fails syntactically or logic
                    // If no similar, we just don't add the ID filter? No, then it returns ALL assets.
                    // We want: ONLY similar OR source.
                    // So if no similar, we add a condition that matches nothing (like 1=0) 
                    // BUT we rely on "Prepend source asset" block which happens AFTER SQL? 
                    // No, `SearchService` runs SQL first.

                    // Wait, the "Prepend source" logic (lines 194-202) operates on `assets` returned from SQL.
                    // If SQL returns nothing, `assets` is empty.
                    // If similar list is empty, we must ensure SQL returns nothing (or just the source if we could).

                    // Better approach: If similar list is empty, set condition to strict ID match on source (if we want to exclude others)
                    // But `relatedToAssetId` usually excludes source in `findSimilar`.
                    // Let's set a condition that matches nothing so `assets` from DB is empty, then we manually add source.
                    conditions.push(`1=0`);
                }

            } else {
                // Exact match on inputs (lineage)
                conditions.push(`EXISTS (SELECT 1 FROM json_each(a.metadata, '$.inputs') WHERE json_each.value = @relatedToAssetId)`);
                params.relatedToAssetId = filters.relatedToAssetId;
            }
        }

        if (filters?.type) { conditions.push(`a.type = @type`); params.type = filters.type; }
        if (filters?.status && filters.status !== 'all' && filters.status.length > 0) { conditions.push(`a.status = @status`); params.status = filters.status; }
        if (filters?.dateFrom) { conditions.push(`a.createdAt >= @dateFrom`); params.dateFrom = filters.dateFrom; }
        if (filters?.dateTo) { conditions.push(`a.createdAt <= @dateTo`); params.dateTo = filters.dateTo; }

        if (filters?.authorId) { conditions.push(`json_extract(a.metadata, '$.authorId') = @authorId`); params.authorId = filters.authorId; }
        if (filters?.project) { conditions.push(`json_extract(a.metadata, '$.project') = @project`); params.project = filters.project; }
        if (filters?.scene) { conditions.push(`json_extract(a.metadata, '$.scene') = @scene`); params.scene = filters.scene; }
        if (filters?.shot) { conditions.push(`json_extract(a.metadata, '$.shot') = @shot`); params.shot = filters.shot; }
        if (filters?.platform) { conditions.push(`json_extract(a.metadata, '$.platform') = @platform`); params.platform = filters.platform; }
        if (filters?.platformUrl) { conditions.push(`json_extract(a.metadata, '$.platformUrl') LIKE @platformUrl`); params.platformUrl = `%${filters.platformUrl}%`; }
        if (filters?.model) { conditions.push(`json_extract(a.metadata, '$.model') = @model`); params.model = filters.model; }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        if (searchQuery && searchQuery.trim() !== '') {
            sql += ` ORDER BY assets_fts.rank, a.createdAt DESC`;
        } else {
            sql += ` ORDER BY a.createdAt DESC`;
        }

        const stmt = db.prepare(sql);
        let assets = stmt.all(params).map((row: any) => ({
            ...row,
            metadata: JSON.parse(row.metadata)
        }));

        // Hybrid Search
        if (searchQuery && searchQuery.trim() !== '' && vectorSearchEnabled) {
            try {
                const embedding = await embeddingService.generateEmbedding(searchQuery);

                if (embedding) {
                    console.log(`[SearchService] Generated query embedding. Preview: [${embedding.slice(0, 5).join(', ')}...]`);

                    const vectorLimit = 50;
                    const vectorStmt = db.prepare(`
                        WITH matches AS (
                            SELECT rowid, distance 
                            FROM vec_assets 
                            WHERE embedding MATCH ?
                            ORDER BY distance
                            LIMIT ?
                        )
                        SELECT a.*, m.distance 
                        FROM matches m
                        JOIN assets a ON a.rowid = m.rowid
                        ORDER BY m.distance ASC
                    `);

                    const vectorResults = vectorStmt.all(JSON.stringify(embedding), vectorLimit).map((row: any) => ({
                        ...row,
                        metadata: JSON.parse(row.metadata)
                    }));

                    console.log(`[SearchService] Vector search returned ${vectorResults.length} raw matches.`);

                    const existingIds = new Set(assets.map((a: any) => a.id));

                    for (const vecAsset of vectorResults) {
                        if (!existingIds.has(vecAsset.id)) {
                            let pass = true;
                            if (filters?.type && vecAsset.type !== filters.type) pass = false;
                            if (filters?.status && vecAsset.status !== filters.status) pass = false;

                            if (pass) {
                                assets.push(vecAsset);
                                existingIds.add(vecAsset.id);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[SearchService] Hybrid search vector query failed:', e);
            }
        }

        // Sort by similarity if needed
        if (filters?.relatedToAssetId && filters.semantic && assets.length > 0 && similarAssetsMap) {
            assets.sort((a: any, b: any) => {
                const distA = similarAssetsMap!.get(a.id) ?? Infinity;
                const distB = similarAssetsMap!.get(b.id) ?? Infinity;
                return distA - distB;
            });
        }

        // Prepend source asset if relatedToAssetId
        if (filters?.relatedToAssetId) {
            const sourceAsset = this.assetManager.getAsset(filters.relatedToAssetId);
            if (sourceAsset) {
                assets = assets.filter((a: any) => a.id !== filters.relatedToAssetId);
                const sourceWithDistance = { ...sourceAsset, distance: 0 };
                assets.unshift(sourceWithDistance as any);
            }
        }

        if (assets.length > 0) {
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
                if (!tagsByAsset[tag.assetId]) tagsByAsset[tag.assetId] = [];
                tagsByAsset[tag.assetId].push({ id: tag.id, name: tag.name, color: tag.color });
            }

            return assets.map((asset: any) => {
                let distance = asset.distance;
                if (filters?.relatedToAssetId && filters.semantic && similarAssetsMap) {
                    const assetId = asset.id as string;
                    const mappedDistance = similarAssetsMap.get(assetId);
                    if (mappedDistance !== undefined) {
                        distance = mappedDistance;
                    }
                }

                return {
                    ...asset,
                    tags: tagsByAsset[asset.id] || [],
                    distance
                };
            }).filter(asset => {
                if (filters?.relatedToAssetId && filters.semantic) {
                    return asset.distance !== undefined;
                }
                return true;
            });
        }

        return assets;
    }

    async handleChatMessage(text: string) {
        try {
            console.log(`[SearchService] Handling chat message: "${text}"`);

            const results = await this.searchAssets(text, { semantic: true });
            const topResults = results.slice(0, 4);

            if (topResults.length > 0) {
                return {
                    type: 'search_results',
                    message: `I found ${results.length} assets. Here are the top matches:`,
                    assets: topResults
                };
            } else {
                return {
                    type: 'chat',
                    message: `I couldn't find any assets matching "${text}".`
                };
            }

        } catch (error) {
            console.error('[SearchService] Error handling chat message:', error);
            return { type: 'error', message: 'I encountered an error while searching.' };
        }
    }
}

export const searchService = new SearchService();
