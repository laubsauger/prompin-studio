import { Database } from 'better-sqlite3';
import db from '../db.js';

export interface HistoryEvent {
    id: number;
    assetId: string;
    action: 'create' | 'update' | 'delete' | 'tag_add' | 'tag_remove';
    field?: string;
    oldValue?: string;
    newValue?: string;
    timestamp: number;
    userId?: string;
}

export interface AnalyticsStats {
    totalAssets: number;
    assetsByStatus: Record<string, number>;
    assetsByType: Record<string, number>;
    assetsByAuthor: Record<string, number>;
    recentActivity: HistoryEvent[];
    ingressOverTime: { date: string; count: number }[];
}

export class AnalyticsService {
    private db: Database;

    constructor() {
        this.db = db;
        this.backfillHistory();
    }

    private backfillHistory() {
        try {
            // Check if we have any history
            const count = (this.db.prepare('SELECT COUNT(*) as count FROM asset_history').get() as any).count;
            if (count === 0) {
                console.log('[AnalyticsService] Backfilling asset history...');
                const stmt = this.db.prepare(`
                    INSERT INTO asset_history (assetId, action, timestamp)
                    SELECT id, 'create', createdAt 
                    FROM assets 
                    WHERE createdAt IS NOT NULL
                `);
                const info = stmt.run();
                console.log(`[AnalyticsService] Backfilled ${info.changes} creation events.`);
            }
        } catch (error) {
            console.error('[AnalyticsService] Failed to backfill history:', error);
        }
    }

    logEvent(
        assetId: string,
        action: 'create' | 'update' | 'delete' | 'tag_add' | 'tag_remove',
        field?: string,
        oldValue?: any,
        newValue?: any,
        userId?: string
    ) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO asset_history (assetId, action, field, oldValue, newValue, timestamp, userId)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                assetId,
                action,
                field || null,
                oldValue !== undefined ? String(oldValue) : null,
                newValue !== undefined ? String(newValue) : null,
                Date.now(),
                userId || null
            );
        } catch (error) {
            console.error('[AnalyticsService] Failed to log event:', error);
        }
    }

    getAssetHistory(assetId: string): HistoryEvent[] {
        const stmt = this.db.prepare(`
            SELECT * FROM asset_history
            WHERE assetId = ?
            ORDER BY timestamp DESC
        `);
        return stmt.all(assetId) as HistoryEvent[];
    }

    getStats(): AnalyticsStats {
        const totalAssets = (this.db.prepare('SELECT COUNT(*) as count FROM assets').get() as any).count;

        const assetsByStatusRaw = this.db.prepare('SELECT status, COUNT(*) as count FROM assets GROUP BY status').all() as { status: string; count: number }[];
        const assetsByStatus = assetsByStatusRaw.reduce((acc, curr) => ({ ...acc, [curr.status]: curr.count }), {});

        const assetsByTypeRaw = this.db.prepare('SELECT type, COUNT(*) as count FROM assets GROUP BY type').all() as { type: string; count: number }[];
        const assetsByType = assetsByTypeRaw.reduce((acc, curr) => ({ ...acc, [curr.type]: curr.count }), {});

        const recentActivity = this.db.prepare(`
            SELECT * FROM asset_history
            ORDER BY timestamp DESC
            LIMIT 50
        `).all() as HistoryEvent[];

        // Ingress over time (last 30 days)
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const ingressRaw = this.db.prepare(`
            SELECT 
                strftime('%Y-%m-%d', datetime(timestamp / 1000, 'unixepoch')) as date,
                COUNT(*) as count
            FROM asset_history
            WHERE action = 'create' AND timestamp > ?
            GROUP BY date
            ORDER BY date ASC
        `).all(thirtyDaysAgo) as { date: string; count: number }[];

        const assetsByAuthorRaw = this.db.prepare("SELECT json_extract(metadata, '$.authorId') as author, COUNT(*) as count FROM assets GROUP BY author").all() as { author: string; count: number }[];
        const assetsByAuthor = assetsByAuthorRaw.reduce((acc, curr) => ({ ...acc, [curr.author || 'Unknown']: curr.count }), {});

        return {
            totalAssets,
            assetsByStatus,
            assetsByType,
            assetsByAuthor,
            recentActivity,
            ingressOverTime: ingressRaw
        };
    }
}

export const analyticsService = new AnalyticsService();
