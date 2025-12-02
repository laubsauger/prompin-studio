import React from 'react';
import { useStore } from '../store';

export const BulkActionsBar: React.FC = () => {
    const { selectedIds, clearSelection, updateAssetStatus, loadAssets } = useStore();

    if (selectedIds.size === 0) return null;

    const handleBulkStatusUpdate = async (status: 'approved' | 'archived' | 'unsorted') => {
        // Optimistic updates could be complex here, so we'll just await all
        const promises = Array.from(selectedIds).map(id => updateAssetStatus(id, status));
        await Promise.all(promises);
        clearSelection();
        loadAssets(); // Refresh to ensure consistency
    };

    return (
        <div className="bulk-actions-bar" style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#333',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            zIndex: 100,
            color: '#fff'
        }}>
            <span>{selectedIds.size} selected</span>

            <div style={{ height: '20px', width: '1px', background: '#555' }} />

            <button onClick={() => handleBulkStatusUpdate('approved')} style={btnStyle}>
                Approve
            </button>
            <button onClick={() => handleBulkStatusUpdate('archived')} style={btnStyle}>
                Archive
            </button>
            <button onClick={() => handleBulkStatusUpdate('unsorted')} style={btnStyle}>
                Reset
            </button>

            <div style={{ height: '20px', width: '1px', background: '#555' }} />

            <button onClick={clearSelection} style={{ ...btnStyle, color: '#aaa' }}>
                Clear
            </button>
        </div>
    );
};

const btnStyle = {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.9rem'
};
