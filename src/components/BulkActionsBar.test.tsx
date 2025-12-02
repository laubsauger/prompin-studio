import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBar } from './BulkActionsBar';
import { useStore } from '../store';

// Mock store
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

describe('BulkActionsBar', () => {
    const mockClearSelection = vi.fn();
    const mockUpdateAssetStatus = vi.fn();
    const mockLoadAssets = vi.fn();

    beforeEach(() => {
        mockClearSelection.mockReset();
        mockUpdateAssetStatus.mockReset();
        mockLoadAssets.mockReset();

        (useStore as any).mockReturnValue({
            selectedIds: new Set(['1', '2']),
            clearSelection: mockClearSelection,
            updateAssetStatus: mockUpdateAssetStatus,
            loadAssets: mockLoadAssets,
        });
    });

    it('renders when items are selected', () => {
        render(<BulkActionsBar />);
        expect(screen.getByText('2 selected')).toBeInTheDocument();
        expect(screen.getByText('Approve')).toBeInTheDocument();
        expect(screen.getByText('Archive')).toBeInTheDocument();
        expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('does not render when no items are selected', () => {
        (useStore as any).mockReturnValue({
            selectedIds: new Set(),
            clearSelection: mockClearSelection,
            updateAssetStatus: mockUpdateAssetStatus,
            loadAssets: mockLoadAssets,
        });
        const { container } = render(<BulkActionsBar />);
        expect(container).toBeEmptyDOMElement();
    });

    it('calls clearSelection on close', () => {
        render(<BulkActionsBar />);
        // Assuming the close button is the one with the X icon, which might be hard to find by text.
        // We can find by role button and pick the first one or look for the icon if we mocked lucide (which we didn't).
        // Let's find by role button. There are 4 buttons (Close, Approve, Archive, Reset).
        // Close is usually the first one in the DOM order in our component (left side).
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        expect(mockClearSelection).toHaveBeenCalled();
    });

    it('calls updateAssetStatus for all selected items on action', async () => {
        render(<BulkActionsBar />);
        const approveButton = screen.getByText('Approve');
        fireEvent.click(approveButton);

        // Should be called for each ID
        expect(mockUpdateAssetStatus).toHaveBeenCalledTimes(2);
        expect(mockUpdateAssetStatus).toHaveBeenCalledWith('1', 'approved');
        expect(mockUpdateAssetStatus).toHaveBeenCalledWith('2', 'approved');

        // Should wait for promises then clear and load
        // Since we can't easily await the internal promise in the component without more mocking,
        // we assume the fireEvent triggers the async function. 
        // In a real integration test we'd wait, but here we just check invocation.
        // However, clearSelection and loadAssets are called AFTER await. 
        // We need to wait for the microtask queue.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockClearSelection).toHaveBeenCalled();
        expect(mockLoadAssets).toHaveBeenCalled();
    });
});
