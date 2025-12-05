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
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            console.log(`[SyncService] Replaying ${jsonFiles.length} files...`);

            const allEvents: SyncEvent[] = [];

            // Read all files first
            for (const file of jsonFiles) {
                try {
                    const content = await fs.readFile(path.join(this.syncDir, file), 'utf-8');
                    const data = JSON.parse(content);
                    if (Array.isArray(data)) {
                        allEvents.push(...data);
                    } else {
                        allEvents.push(data);
                    }
                } catch (e) {
                    console.warn(`[SyncService] Failed to read event file ${file}:`, e);
                }
            }

            // Sort by timestamp
            allEvents.sort((a, b) => a.timestamp - b.timestamp);

            console.log(`[SyncService] Processing ${allEvents.length} total events...`);

            // Process in order
            for (const event of allEvents) {
                this.processEvent(event);
            }

            // Trigger compaction after replay
            this.compactEvents(jsonFiles);

        } catch (error) {
            console.error('[SyncService] Failed to replay events:', error);
        }
    }

    private async compactEvents(allFiles: string[]) {
        if (!this.syncDir) return;

        // Identify individual event files (not already compacted)
        const individualFiles = allFiles.filter(f => !f.startsWith('compacted_') && f.endsWith('.json'));

        if (individualFiles.length < 50) return; // Threshold to avoid frequent compaction

        console.log(`[SyncService] Compacting ${individualFiles.length} event files...`);

        try {
            const eventsToCompact: SyncEvent[] = [];
            const filesToDelete: string[] = [];

            for (const file of individualFiles) {
                try {
                    const filePath = path.join(this.syncDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const event = JSON.parse(content);
                    eventsToCompact.push(event);
                    filesToDelete.push(filePath);
                } catch (e) {
                    console.warn(`[SyncService] Failed to read file for compaction ${file}:`, e);
                }
            }

            if (eventsToCompact.length === 0) return;

            // Sort events
            eventsToCompact.sort((a, b) => a.timestamp - b.timestamp);

            // Create compacted file
            const maxTimestamp = eventsToCompact[eventsToCompact.length - 1].timestamp;
            const compactedFilename = `compacted_${maxTimestamp}_${uuidv4()}.json`;
            const compactedPath = path.join(this.syncDir, compactedFilename);

            await fs.writeFile(compactedPath, JSON.stringify(eventsToCompact, null, 2));
            console.log(`[SyncService] Wrote compacted file: ${compactedFilename}`);

            // Delete old files
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file);
                } catch (e) {
                    // Ignore delete errors (race conditions etc)
                }
            }
            console.log(`[SyncService] Deleted ${filesToDelete.length} old event files.`);

        } catch (error) {
            console.error('[SyncService] Compaction failed:', error);
        }
    }

    private async processEventFile(filePath: string) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            if (Array.isArray(data)) {
                // Handle compacted file (array of events)
                // We should sort them by timestamp just in case
                const events = data as SyncEvent[];
                events.sort((a, b) => a.timestamp - b.timestamp);

                for (const event of events) {
                    this.processEvent(event);
                }
            } else {
                // Handle single event file
                this.processEvent(data as SyncEvent);
            }
        } catch (error) {
            console.error(`[SyncService] Failed to process event file ${filePath}:`, error);
        }
    }

    private processEvent(event: SyncEvent) {
        // Skip if we processed this event already (e.g. we wrote it)
        if (this.processedEvents.has(event.id)) return;

        // Skip if it's our own event (double check)
        if (event.userId === this.userId) return;

        this.processedEvents.add(event.id);
        this.addToHistory(event);
        this.emit('event', event);
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
        this.addToHistory(event);

        const fileName = `${event.timestamp}_${event.id}.json`;
        const filePath = path.join(this.syncDir, fileName);

        try {
            await fs.writeFile(filePath, JSON.stringify(event, null, 2));
            // console.log(`[SyncService] Published event ${type} to ${fileName}`);
        } catch (error) {
            console.error('[SyncService] Failed to publish event:', error);
        }
    }

    private history: SyncEvent[] = [];
    private readonly MAX_HISTORY = 100;

    getHistory(): SyncEvent[] {
        return [...this.history].sort((a, b) => b.timestamp - a.timestamp);
    }

    getStatus() {
        return {
            userId: this.userId,
            syncDir: this.syncDir,
            eventCount: this.processedEvents.size,
            connected: !!this.watcher
        };
    }

    private addToHistory(event: SyncEvent) {
        this.history.unshift(event);
        if (this.history.length > this.MAX_HISTORY) {
            this.history = this.history.slice(0, this.MAX_HISTORY);
        }
    }

    async stop() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}

export const syncService = new SyncService();
