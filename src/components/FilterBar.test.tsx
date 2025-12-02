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
        (useStore as any).mockReturnValue({
            filter: 'all',
            setFilter: mockSetFilter,
        });
    });

    it('renders correctly', () => {
        render(<FilterBar />);
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    it('calls setFilter on change', () => {
        render(<FilterBar />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'approved' } });
        expect(mockSetFilter).toHaveBeenCalledWith('approved');
    });

    it('displays current filter value', () => {
        (useStore as any).mockReturnValue({
            filter: 'approved',
            setFilter: mockSetFilter,
        });
        render(<FilterBar />);
        const select = screen.getByRole('combobox') as HTMLSelectElement;
        expect(select.value).toBe('approved');
    });
});
