import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';

export type SyncEventType =
    | 'ASSET_UPDATE'
    | 'TAG_CREATE'
    | 'TAG_DELETE'
    | 'ASSET_TAG_ADD'
    | 'ASSET_TAG_REMOVE';

export interface SyncEvent {
    id: string;
    timestamp: number;
    userId: string;
    type: SyncEventType;
    payload: any;
}

export class SyncService extends EventEmitter {
    private syncDir: string | null = null;
    private userId: string;
    private watcher: any = null;
    private processedEvents: Set<string> = new Set();

    constructor() {
        super();
        // Generate a random user ID for this session if not persisted
        // In a real app, this should be persisted or come from auth
        this.userId = `user_${uuidv4().substring(0, 8)}`;
    }

    async initialize(rootPath: string) {
        this.syncDir = path.join(rootPath, '.prompin-studio', 'events');

        try {
            await fs.mkdir(this.syncDir, { recursive: true });
        } catch (error) {
            console.error('[SyncService] Failed to create sync directory:', error);
            return;
        }

        console.log(`[SyncService] Initialized at ${this.syncDir} as ${this.userId}`);

        // Start watching
        this.startWatcher();

        // Replay existing events
        await this.replayEvents();
    }

    private startWatcher() {
        if (!this.syncDir) return;

        this.watcher = chokidar.watch(this.syncDir, {
            ignoreInitial: true, // We handle initial scan manually in replayEvents
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 100
            }
        });

        this.watcher.on('add', async (filePath: string) => {
            if (!filePath.endsWith('.json')) return;
            await this.processEventFile(filePath);
        });
    }

    private async replayEvents() {
        if (!this.syncDir) return;

        try {
            const files = await fs.readdir(this.syncDir);
            const jsonFiles = files.filter(f => f.endsWith('.json')).sort(); // Sort by name (timestamp)

            console.log(`[SyncService] Replaying ${jsonFiles.length} events...`);

            for (const file of jsonFiles) {
                await this.processEventFile(path.join(this.syncDir, file));
            }
        } catch (error) {
            console.error('[SyncService] Failed to replay events:', error);
        }
    }

    private async processEventFile(filePath: string) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const event: SyncEvent = JSON.parse(content);

            // Skip if we processed this event already (e.g. we wrote it)
            if (this.processedEvents.has(event.id)) return;

            // Skip if it's our own event (double check)
            if (event.userId === this.userId) return;

            this.processedEvents.add(event.id);
            this.emit('event', event);
        } catch (error) {
            console.error(`[SyncService] Failed to process event file ${filePath}:`, error);
        }
    }

    async publish(type: SyncEventType, payload: any) {
        if (!this.syncDir) return;

        const event: SyncEvent = {
            id: uuidv4(),
            timestamp: Date.now(),
            userId: this.userId,
            type,
            payload
        };

        // Mark as processed so we don't re-emit it when watcher sees the file
        this.processedEvents.add(event.id);

        const fileName = `${event.timestamp}_${event.id}.json`;
        const filePath = path.join(this.syncDir, fileName);

        try {
            await fs.writeFile(filePath, JSON.stringify(event, null, 2));
            // console.log(`[SyncService] Published event ${type} to ${fileName}`);
        } catch (error) {
            console.error('[SyncService] Failed to publish event:', error);
        }
    }

    async stop() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}
