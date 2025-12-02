import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetCard } from '../components/AssetCard';
import { useStore } from '../store';

// Mock store
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

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
        (useStore as any).mockReturnValue({
            updateAssetStatus: mockUpdateStatus,
            addComment: vi.fn(),
            updateMetadata: vi.fn(),
            selectedIds: new Set(),
            toggleSelection: vi.fn(),
            selectRange: vi.fn(),
        });
    });

    it('renders asset path', () => {
        render(<AssetCard asset={mockAsset as any} />);
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
    });

    it('calls updateAssetStatus on change', () => {
        render(<AssetCard asset={mockAsset as any} />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'approved' } });
        expect(mockUpdateStatus).toHaveBeenCalledWith('1', 'approved');
    });

    it('calls updateMetadata on blur', () => {
        const mockUpdateMetadata = vi.fn();
        (useStore as any).mockReturnValue({
            updateAssetStatus: mockUpdateStatus,
            addComment: vi.fn(),
            updateMetadata: mockUpdateMetadata,
            selectedIds: new Set(),
            toggleSelection: vi.fn(),
            selectRange: vi.fn(),
        });

        render(<AssetCard asset={mockAsset as any} />);
        const projectInput = screen.getByPlaceholderText('Project');
        fireEvent.change(projectInput, { target: { value: 'New Project' } });
        fireEvent.blur(projectInput);

        expect(mockUpdateMetadata).toHaveBeenCalledWith('1', 'project', 'New Project');
    });

    it('calls addComment on Enter', () => {
        const mockAddComment = vi.fn();
        (useStore as any).mockReturnValue({
            updateAssetStatus: mockUpdateStatus,
            addComment: mockAddComment,
            updateMetadata: vi.fn(),
            selectedIds: new Set(),
            toggleSelection: vi.fn(),
            selectRange: vi.fn(),
        });

        render(<AssetCard asset={mockAsset as any} />);
        const commentInput = screen.getByPlaceholderText('Add comment...');
        fireEvent.change(commentInput, { target: { value: 'Nice!' } });
        fireEvent.keyDown(commentInput, { key: 'Enter' });

        expect(mockAddComment).toHaveBeenCalledWith('1', 'Nice!');
    });
});
