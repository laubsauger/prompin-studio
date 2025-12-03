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

    beforeEach(() => {
        const state = {
            filter: 'all',
            setFilter: mockSetFilter,
            filterConfig: { type: 'all', likedOnly: false },
            setFilterConfig: vi.fn(),
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

    it('calls setFilter on change', () => {
        render(<FilterBar thumbnailSize={150} onThumbnailSizeChange={vi.fn()} />);
        const selects = screen.getAllByRole('combobox');
        // Status select is the 3rd one
        const statusSelect = selects[2];
        fireEvent.change(statusSelect, { target: { value: 'approved' } });
        expect(mockSetFilter).toHaveBeenCalledWith('approved');
    });

    it('displays current filter value', () => {
        const state = {
            filter: 'approved',
            setFilter: mockSetFilter,
            filterConfig: { type: 'all', likedOnly: false },
            setFilterConfig: vi.fn(),
            tags: [],
            scratchPads: [],
            sortConfig: { key: 'createdAt', direction: 'desc' },
            setSortConfig: vi.fn(),
            viewMode: 'grid',
            setViewMode: vi.fn(),
        };
        (useStore as any).mockImplementation((selector: any) => selector ? selector(state) : state);
        render(<FilterBar thumbnailSize={150} onThumbnailSizeChange={vi.fn()} />);
        const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
        const statusSelect = selects[2];
        expect(statusSelect.value).toBe('approved');
    });
});
