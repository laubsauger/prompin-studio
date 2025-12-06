import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';

// Redefine type for frontend to avoid importing from electron folder directly if not set up for shared types
interface HistoryEvent {
    id: number;
    assetId: string;
    action: 'create' | 'update' | 'delete' | 'tag_add' | 'tag_remove';
    field?: string;
    oldValue?: string;
    newValue?: string;
    timestamp: number;
    userId?: string;
}

interface AssetHistoryProps {
    assetId: string;
}

export const AssetHistory: React.FC<AssetHistoryProps> = ({ assetId }) => {
    const [history, setHistory] = useState<HistoryEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                // @ts-ignore
                const data = await window.ipcRenderer.invoke('get-asset-history', assetId);
                if (mounted) setHistory(data);
            } catch (error) {
                console.error('Failed to fetch asset history:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchHistory();
        return () => { mounted = false; };
    }, [assetId]);

    if (loading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading history...</div>;
    }

    if (history.length === 0) {
        return <div className="p-4 text-sm text-muted-foreground">No history available.</div>;
    }

    return (
        <ScrollArea className="h-[300px] w-full">
            <div className="space-y-2 px-1">
                {history.map((event) => (
                    <div key={event.id} className="text-xs border-l-2 border-border/50 pl-3 py-1 hover:border-primary/50 transition-colors">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium capitalize">
                                {event.action.replace('_', ' ')}
                            </span>
                            {event.field && (
                                <span className="text-muted-foreground">
                                    · <span className="font-mono">{event.field}</span>
                                </span>
                            )}
                            {event.userId && (
                                <span className="text-muted-foreground">
                                    by <span className="font-medium">{event.userId}</span>
                                </span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                                {format(event.timestamp, 'MMM d, HH:mm')}
                            </span>
                        </div>
                        {event.oldValue && event.newValue && (
                            <div className="flex gap-2 mt-1">
                                <span className="text-[10px] text-red-600 dark:text-red-400 truncate max-w-[45%]" title={event.oldValue}>
                                    - {event.oldValue}
                                </span>
                                <span className="text-[10px] text-green-600 dark:text-green-400 truncate max-w-[45%]" title={event.newValue}>
                                    + {event.newValue}
                                </span>
                            </div>
                        )}
                        {!event.oldValue && event.newValue && (
                            <div className="text-[10px] mt-0.5 text-green-600 dark:text-green-400 truncate" title={event.newValue}>
                                + {event.newValue}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
};
