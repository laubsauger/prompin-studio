import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useStore } from '../store';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the store
vi.mock('../store');

describe('Sidebar', () => {
    const mockUseStore = useStore as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                assets: [],
                folders: ['folder1', 'folder1/subfolder'],
                tags: [{ id: 'tag1', name: 'Test Tag', color: '#ff0000' }],
                scratchPads: [{ id: 'pad1', name: 'Test Pad', assetIds: [] }],
                activeViews: [],
                filterConfig: {},
                currentPath: null,
                folderColors: {},
                setCurrentPath: vi.fn(),
                setFilterConfig: vi.fn(),
                setFolderColor: vi.fn(),
                createTag: vi.fn(),
                createScratchPad: vi.fn(),
                deleteTag: vi.fn(),
                deleteScratchPad: vi.fn(),
                removeActiveView: vi.fn(),
                setLastInboxViewTime: vi.fn(),
                lastInboxViewTime: 0,
            };
            return selector(state);
        });

        // Mock getState for non-hook usage
        (useStore as any).getState = () => ({
            setLastInboxViewTime: vi.fn(),
            lastInboxViewTime: 0,
            deleteTag: vi.fn(),
            deleteScratchPad: vi.fn(),
            removeActiveView: vi.fn(),
        });
    });

    it('renders all sections', () => {
        render(<Sidebar />);
        expect(screen.getByText('Library')).toBeInTheDocument();
        expect(screen.getByText('Folders')).toBeInTheDocument();
        expect(screen.getByText('Tags')).toBeInTheDocument();
        expect(screen.getByText('Review Status')).toBeInTheDocument();
        expect(screen.getByText('Views')).toBeInTheDocument();
        expect(screen.getByText('Scratch Pads')).toBeInTheDocument();
    });

    it('renders library items', () => {
        render(<Sidebar />);
        expect(screen.getByText('All Media')).toBeInTheDocument();
        expect(screen.getByText('Inbox')).toBeInTheDocument();
        expect(screen.getByText('Favorites')).toBeInTheDocument();
    });

    it('renders folders', () => {
        render(<Sidebar />);
        expect(screen.getByText('folder1')).toBeInTheDocument();
    });

    it('renders tags', () => {
        render(<Sidebar />);
        expect(screen.getByText('Test Tag')).toBeInTheDocument();
    });

    it('renders scratch pads', () => {
        render(<Sidebar />);
        expect(screen.getByText('Test Pad')).toBeInTheDocument();
    });

    it('toggles sections', () => {
        render(<Sidebar />);
        const libraryHeader = screen.getByText('Library');
        fireEvent.click(libraryHeader);
        // Content should be hidden (implementation detail: checking if children are removed or hidden)
        // Since we use conditional rendering {isOpen && ...}, element should be gone
        expect(screen.queryByText('All Media')).not.toBeInTheDocument();

        fireEvent.click(libraryHeader);
        expect(screen.getByText('All Media')).toBeInTheDocument();
    });
});
