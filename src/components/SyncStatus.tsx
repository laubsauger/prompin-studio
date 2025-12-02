import React, { useEffect } from 'react';
import { useStore } from '../store';

export const SyncStatus: React.FC = () => {
    const { syncStats, fetchSyncStats, triggerResync } = useStore();

    useEffect(() => {
        fetchSyncStats();
        const interval = setInterval(fetchSyncStats, 1000); // Poll every second
        return () => clearInterval(interval);
    }, [fetchSyncStats]);

    if (!syncStats) return null;

    return (
        <div className="sync-status" style={{
            padding: '0.5rem 1rem',
            background: '#222',
            borderBottom: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.8rem',
            color: '#ccc'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: syncStats.status === 'idle' ? '#4caf50' : '#ff9800'
                }} />
                <span>{syncStats.status.toUpperCase()}</span>
            </div>

            <div>
                Files: {syncStats.processedFiles} / {syncStats.totalFiles}
            </div>

            <button
                onClick={triggerResync}
                disabled={syncStats.status !== 'idle'}
                style={{
                    marginLeft: 'auto',
                    padding: '4px 8px',
                    background: '#444',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: syncStats.status === 'idle' ? 'pointer' : 'not-allowed',
                    opacity: syncStats.status === 'idle' ? 1 : 0.5
                }}
            >
                Resync
            </button>
        </div>
    );
};
