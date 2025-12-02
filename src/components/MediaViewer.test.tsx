import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaViewer } from './MediaViewer';
import { useStore } from '../store';

// Mock store
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

// Mock react-zoom-pan-pinch
vi.mock('react-zoom-pan-pinch', () => ({
    TransformWrapper: ({ children }: any) => <div>{children}</div>,
    TransformComponent: ({ children }: any) => <div>{children}</div>,
}));

describe('MediaViewer', () => {
    const mockSetViewingAssetId = vi.fn();

    beforeEach(() => {
        mockSetViewingAssetId.mockReset();
        (useStore as any).mockReturnValue({
            viewingAssetId: '1',
            setViewingAssetId: mockSetViewingAssetId,
            assets: [
                { id: '1', path: 'test.jpg', type: 'image' },
                { id: '2', path: 'video.mp4', type: 'video' },
            ],
        });
    });

    it('renders image viewer when image is selected', () => {
        render(<MediaViewer />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'file://test.jpg');
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
    });

    it('renders video player when video is selected', () => {
        (useStore as any).mockReturnValue({
            viewingAssetId: '2',
            setViewingAssetId: mockSetViewingAssetId,
            assets: [
                { id: '1', path: 'test.jpg', type: 'image' },
                { id: '2', path: 'video.mp4', type: 'video' },
            ],
        });
        render(<MediaViewer />);
        // Video tag might not have a role by default in some setups, but let's try finding by tag or src
        // Actually, let's just query selector
        expect(document.querySelector('video')).toBeInTheDocument();
        expect(document.querySelector('video')).toHaveAttribute('src', 'file://video.mp4');
    });

    it('does not render when no asset is selected', () => {
        (useStore as any).mockReturnValue({
            viewingAssetId: null,
            setViewingAssetId: mockSetViewingAssetId,
            assets: [],
        });
        const { container } = render(<MediaViewer />);
        expect(container).toBeEmptyDOMElement();
    });

    it('calls setViewingAssetId(null) on close button click', () => {
        render(<MediaViewer />);
        const closeButton = screen.getByRole('button');
        fireEvent.click(closeButton);
        expect(mockSetViewingAssetId).toHaveBeenCalledWith(null);
    });

    it('calls setViewingAssetId(null) on Escape key', () => {
        render(<MediaViewer />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mockSetViewingAssetId).toHaveBeenCalledWith(null);
    });
});
