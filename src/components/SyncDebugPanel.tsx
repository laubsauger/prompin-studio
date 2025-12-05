import React, { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { RefreshCw, Activity } from 'lucide-react';

interface SyncEvent {
    id: string;
    timestamp: number;
    userId: string;
    type: string;
    payload: any;
}

interface SyncStatus {
    userId: string;
    syncDir: string;
    eventCount: number;
    connected: boolean;
}

export const SyncDebugPanel: React.FC = () => {
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [history, setHistory] = useState<SyncEvent[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    const fetchStatus = async () => {
        try {
            // @ts-ignore
            const s = await window.ipcRenderer.invoke('get-sync-status');
            setStatus(s);
            // @ts-ignore
            const h = await window.ipcRenderer.invoke('get-sync-history');
            setHistory(h);
            setIsConnected(true);
        } catch (error) {
            console.error('Failed to fetch sync status:', error);
            setIsConnected(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Poll status every 5s

        // Listen for real-time events
        // @ts-ignore
        const removeListener = window.ipcRenderer.on('sync-event', (event: any, syncEvent: SyncEvent) => {
            setHistory(prev => [syncEvent, ...prev].slice(0, 100));
            setStatus(prev => prev ? { ...prev, eventCount: prev.eventCount + 1 } : null);
        });

        return () => {
            clearInterval(interval);
            if (typeof removeListener === 'function') {
                (removeListener as Function)();
            }
        };
    }, []);

    if (!isConnected && !status) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                Connecting to sync service...
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[500px] gap-4">
            {/* Status Header */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-muted/30">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Local User ID</div>
                    <div className="font-mono text-sm truncate" title={status?.userId}>
                        {status?.userId || 'Unknown'}
                    </div>
                </Card>
                <Card className="p-4 bg-muted/30">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Sync Directory</div>
                    <div className="font-mono text-xs truncate text-muted-foreground" title={status?.syncDir}>
                        {status?.syncDir || 'Not configured'}
                    </div>
                </Card>
            </div>

            {/* Event Stream */}
            <Card className="flex-1 flex flex-col overflow-hidden border-muted">
                <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Event Stream</span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                            {history.length} events
                        </Badge>
                    </div>
                    <button
                        onClick={fetchStatus}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>

                <ScrollArea className="flex-1">
                    <div className="divide-y divide-border/50">
                        {history.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No events recorded yet.
                            </div>
                        ) : (
                            history.map((event) => {
                                const isMe = event.userId === status?.userId;
                                return (
                                    <div key={event.id} className="p-3 hover:bg-muted/30 transition-colors text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={isMe ? "default" : "outline"}
                                                    className="text-[10px] h-5 px-1.5"
                                                >
                                                    {isMe ? 'OUT' : 'IN'}
                                                </Badge>
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
                                                {event.userId}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-primary/90">
                                                {event.type}
                                            </span>
                                        </div>

                                        <pre className="text-[10px] bg-muted/50 p-1.5 rounded overflow-x-auto text-muted-foreground font-mono">
                                            {JSON.stringify(event.payload, null, 2)}
                                        </pre>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </Card>
        </div>
    );
};
