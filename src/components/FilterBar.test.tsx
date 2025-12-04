import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import { useStore } from '../store';

// Mock store
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

describe('FilterBar', () => {
    const mockSetFilter = vi.fn();
    const mockSetFilterConfig = vi.fn();

    beforeEach(() => {
        const state = {
            filter: 'all',
            setFilter: mockSetFilter,
            filterConfig: { type: 'all', likedOnly: false },
            setFilterConfig: mockSetFilterConfig,
            tags: [],
            scratchPads: [],
            sortConfig: { key: 'createdAt', direction: 'desc' },
            setSortConfig: vi.fn(),
            viewMode: 'grid',
            setViewMode: vi.fn(),
        };
        (useStore as any).mockImplementation((selector: any) => selector ? selector(state) : state);
    });

    it('renders correctly', () => {
        render(<FilterBar thumbnailSize={150} onThumbnailSizeChange={vi.fn()} />);
        expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('calls setFilterConfig on status change', () => {
        render(<FilterBar thumbnailSize={150} onThumbnailSizeChange={vi.fn()} />);

        // Find the status trigger button
        const statusButton = screen.getByRole('combobox', { name: /status/i });
        fireEvent.click(statusButton);

        // Find and click the 'Approved' option
        const approvedOption = screen.getByText('Approved');
        fireEvent.click(approvedOption);

        expect(mockSetFilterConfig).toHaveBeenCalledWith({ statuses: ['approved'] });
    });

    it('displays current filter value', () => {
        const state = {
            filter: 'all',
            setFilter: mockSetFilter,
            filterConfig: { type: 'all', likedOnly: false, statuses: ['approved'] },
            setFilterConfig: mockSetFilterConfig,
            tags: [],
            scratchPads: [],
            sortConfig: { key: 'createdAt', direction: 'desc' },
            setSortConfig: vi.fn(),
            viewMode: 'grid',
            setViewMode: vi.fn(),
        };
        (useStore as any).mockImplementation((selector: any) => selector ? selector(state) : state);
        render(<FilterBar thumbnailSize={150} onThumbnailSizeChange={vi.fn()} />);

        // Check if the status button shows the selected status
        expect(screen.getByText('Approved')).toBeInTheDocument();
    });
});
