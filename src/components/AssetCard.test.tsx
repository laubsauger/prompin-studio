import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssetCard } from '../components/AssetCard';
import { useStore } from '../store';

// Mock store
vi.mock('../store', () => ({
    useStore: Object.assign(vi.fn(), {
        getState: vi.fn(() => ({
            scratchPads: [],
            tags: [],
        })),
    }),
}));

// Mock vidstack
vi.mock('@vidstack/react', () => ({
    MediaPlayer: ({ children, ...props }: any) => <div data-testid="media-player" {...props}>{children}</div>,
    MediaProvider: () => <div data-testid="media-provider" />,
}));

vi.mock('@vidstack/react/player/layouts/default', () => ({
    DefaultVideoLayout: () => <div data-testid="default-video-layout" />,
    defaultLayoutIcons: {},
}));

vi.mock('./MinimalVideoLayout', () => ({
    MinimalVideoLayout: () => <div data-testid="minimal-video-layout" />,
}));

// Mock ipcRenderer
Object.defineProperty(window, 'ipcRenderer', {
    value: {
        invoke: vi.fn().mockResolvedValue({ username: 'test', fullName: 'Test User' }),
        on: vi.fn(),
        removeListener: vi.fn(),
    },
    writable: true
});

describe('AssetCard', () => {
    const mockAsset = {
        id: '1',
        path: 'test.jpg',
        type: 'image',
        status: 'unsorted',
        metadata: {},
        createdAt: 0,
        updatedAt: 0,
    };

    const mockUpdateStatus = vi.fn();

    beforeEach(() => {
        const state = {
            updateAssetStatus: mockUpdateStatus,
            addComment: vi.fn(),
            updateMetadata: vi.fn(),
            selectedIds: new Set(),
            toggleSelection: vi.fn(),
            selectRange: vi.fn(),
            toggleLike: vi.fn(),
            setViewingAssetId: vi.fn(),
            scratchPads: [],
            tags: [],
            filterConfig: {},
        };
        (useStore as any).mockImplementation((selector: any) => selector ? selector(state) : state);
        // Also mock getState for AssetContextMenu
        (useStore as any).getState = () => state;
    });

    it('renders asset path', () => {
        render(<AssetCard asset={mockAsset as any} />);
        expect(screen.getByAltText('test.jpg')).toBeInTheDocument();
    });

    // Obsolete status test removed

    // Obsolete tests removed
});
