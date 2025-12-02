import React, { useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useStore } from '../store';

export const MediaViewer: React.FC = () => {
    const { viewingAssetId, setViewingAssetId, assets } = useStore();

    const asset = assets.find(a => a.id === viewingAssetId);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setViewingAssetId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setViewingAssetId]);

    if (!asset) return null;

    return (
        <div
            className="media-viewer-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.9)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
                <span>{asset.path}</span>
                <button onClick={() => setViewingAssetId(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                    ✕ Close
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {asset.type === 'image' ? (
                    <TransformWrapper>
                        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                            <img
                                src={`file://${asset.path}`}
                                alt={asset.path}
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                        </TransformComponent>
                    </TransformWrapper>
                ) : (
                    <video
                        src={`file://${asset.path}`}
                        controls
                        autoPlay
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                )}
            </div>
        </div>
    );
};
