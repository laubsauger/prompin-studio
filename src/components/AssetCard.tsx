import React from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';

export const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
    const { updateAssetStatus, addComment, updateMetadata, toggleSelection, selectRange } = useStore();
    const isSelected = useStore(state => state.selectedIds.has(asset.id));

    const handleClick = (e: React.MouseEvent) => {
        // Prevent selection when clicking interactive elements
        if ((e.target as HTMLElement).closest('select, input, button')) return;

        if (e.shiftKey) {
            selectRange(asset.id);
        } else {
            toggleSelection(asset.id, e.metaKey || e.ctrlKey);
        }
    };

    return (
        <div
            className={`asset-card ${isSelected ? 'selected' : ''}`}
            onClick={handleClick}
            style={{
                border: isSelected ? '2px solid #2196f3' : '1px solid #333',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#1a1a1a',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
            }}
        >
            <div className="preview" style={{ position: 'relative', aspectRatio: '16/9' }}>
                {asset.type === 'image' && (
                    <img
                        src={`file://${asset.path}`}
                        alt={asset.path}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}
                {asset.type === 'video' && (
                    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        🎥
                    </div>
                )}
                <div className="status-badge" style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    color: '#fff'
                }}>
                    {asset.status}
                </div>
            </div>

            <div className="info" style={{ padding: '0.8rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.8rem', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {asset.path}
                </p>

                <div className="actions">
                    <select
                        value={asset.status}
                        onChange={(e) => updateAssetStatus(asset.id, e.target.value as Asset['status'])}
                        style={{ width: '100%', padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}
                    >
                        <option value="unsorted">Unsorted</option>
                        <option value="review_requested">Request Review</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="archived">Archived</option>
                        <option value="offline">Offline</option>
                    </select>
                </div>

                {/* Metadata Assignment */}
                <div className="metadata-inputs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <input
                        placeholder="Project"
                        defaultValue={asset.metadata.project || ''}
                        onBlur={(e) => updateMetadata(asset.id, 'project', e.target.value)}
                        style={{ background: '#222', border: 'none', padding: '4px', color: '#ccc', fontSize: '0.7rem', borderRadius: '2px' }}
                    />
                    <input
                        placeholder="Scene"
                        defaultValue={asset.metadata.scene || ''}
                        onBlur={(e) => updateMetadata(asset.id, 'scene', e.target.value)}
                        style={{ background: '#222', border: 'none', padding: '4px', color: '#ccc', fontSize: '0.7rem', borderRadius: '2px' }}
                    />
                    <input
                        placeholder="Shot"
                        defaultValue={asset.metadata.shot || ''}
                        onBlur={(e) => updateMetadata(asset.id, 'shot', e.target.value)}
                        style={{ background: '#222', border: 'none', padding: '4px', color: '#ccc', fontSize: '0.7rem', borderRadius: '2px' }}
                    />
                </div>

                {/* Comments Section */}
                <div className="comments" style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #333' }}>
                    <div style={{ maxHeight: '60px', overflowY: 'auto', fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem' }}>
                        {asset.metadata.comments?.map(c => (
                            <div key={c.id} style={{ marginBottom: '2px' }}>
                                <strong>{c.authorId}:</strong> {c.text}
                            </div>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder="Add comment..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                addComment(asset.id, e.currentTarget.value);
                                e.currentTarget.value = '';
                            }
                        }}
                        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #444', color: '#fff', fontSize: '0.8rem' }}
                    />
                </div>
            </div>
        </div>
    );
};
