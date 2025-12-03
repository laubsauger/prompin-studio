import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchPalette } from './SearchPalette';
import { useStore } from '../store';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the store
vi.mock('../store');

// Mock ResizeObserver for cmdk
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = function () { };

describe('SearchPalette', () => {
    const mockUseStore = useStore as unknown as ReturnType<typeof vi.fn>;
    const mockSearchAssets = vi.fn();
    const mockSetSearchQuery = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                searchQuery: '',
                setSearchQuery: mockSetSearchQuery,
                searchAssets: mockSearchAssets,
                triggerResync: vi.fn(),
                setCurrentPath: vi.fn(),
                setFilterConfig: vi.fn(),
                selectedIds: new Set(),
                updateAssetStatus: vi.fn(),
                createScratchPad: vi.fn(),
                clearSelection: vi.fn(),
                setViewingAssetId: vi.fn(),
                assets: [
                    {
                        id: '1',
                        path: 'test/image.png',
                        type: 'image',
                        metadata: { prompt: 'test prompt' },
                        thumbnailPath: 'thumb1.png'
                    },
                    {
                        id: '2',
                        path: 'test/video.mp4',
                        type: 'video',
                        metadata: {},
                        thumbnailPath: 'thumb2.png'
                    }
                ],
            };
            return selector ? selector(state) : state;
        });

        (useStore as any).getState = () => ({
            createTag: vi.fn(),
            addTagToAsset: vi.fn(),
            setLastInboxViewTime: vi.fn(),
        });
    });

    it('renders the search button', () => {
        render(<SearchPalette />);
        expect(screen.getByText('Search...')).toBeInTheDocument();
        expect(screen.getByText('⌘K')).toBeInTheDocument();
    });

    it('opens search palette on click', () => {
        render(<SearchPalette />);
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByPlaceholderText('Search files, metadata, projects...')).toBeInTheDocument();
    });

    it('opens search palette on keyboard shortcut', () => {
        render(<SearchPalette />);
        fireEvent.keyDown(document, { key: 'k', metaKey: true });
        expect(screen.getByPlaceholderText('Search files, metadata, projects...')).toBeInTheDocument();
    });

    it('displays search results', () => {
        render(<SearchPalette />);
        fireEvent.click(screen.getByRole('button'));

        // Check if assets are rendered in the list
        // Note: cmdk might render items lazily or differently, but usually text is present
        expect(screen.getByText('image.png')).toBeInTheDocument();
        expect(screen.getByText('video.mp4')).toBeInTheDocument();
        expect(screen.getByText('"test prompt"')).toBeInTheDocument();
    });

    it('triggers search on input change', async () => {
        render(<SearchPalette />);
        fireEvent.click(screen.getByRole('button'));

        const input = screen.getByPlaceholderText('Search files, metadata, projects...');
        fireEvent.change(input, { target: { value: 'test' } });

        // Wait for debounce
        await waitFor(() => {
            expect(mockSearchAssets).toHaveBeenCalledWith('test');
        }, { timeout: 1000 });
    });
});
