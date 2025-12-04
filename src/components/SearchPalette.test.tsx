import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchPalette } from './SearchPalette';
import { useStore } from '../store';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the store
vi.mock('../store');

// Mock ResizeObserver for cmdk
(globalThis as any).ResizeObserver = class ResizeObserver {
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

    const mockPreviewSearch = vi.fn().mockResolvedValue([
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
    ]);

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                searchQuery: '',
                setSearchQuery: mockSetSearchQuery,
                searchAssets: mockSearchAssets,
                previewSearch: mockPreviewSearch,
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

    // ... (other tests)

    it('triggers search on input change', async () => {
        render(<SearchPalette />);
        fireEvent.click(screen.getByRole('button'));

        const input = screen.getByPlaceholderText('Search files, metadata, projects...');
        fireEvent.change(input, { target: { value: 'test' } });

        // Wait for debounce
        await waitFor(() => {
            expect(mockPreviewSearch).toHaveBeenCalledWith('test');
        }, { timeout: 1000 });
    });
});
