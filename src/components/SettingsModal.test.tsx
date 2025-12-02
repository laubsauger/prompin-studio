import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { useSettingsStore } from '../store/settings';

// Mock store
vi.mock('../store/settings', () => ({
    useSettingsStore: vi.fn(),
}));

// Mock Dialog components since they use Radix primitives which might need setup
vi.mock('./ui/dialog', () => ({
    Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
    DialogContent: ({ children }: any) => <div>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <div>{children}</div>,
    DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('./ui/switch', () => ({
    Switch: ({ checked, onCheckedChange }: any) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            role="switch"
        />
    ),
}));

vi.mock('./ui/select', () => ({
    Select: ({ value, onChange, children }: any) => (
        <select value={value} onChange={onChange} role="combobox">
            {children}
        </select>
    ),
}));

describe('SettingsModal', () => {
    const mockSetTheme = vi.fn();
    const mockSetDefaultView = vi.fn();
    const mockSetAutoCheckUpdates = vi.fn();

    beforeEach(() => {
        (useSettingsStore as any).mockReturnValue({
            theme: 'system',
            defaultView: 'grid',
            autoCheckUpdates: true,
            setTheme: mockSetTheme,
            setDefaultView: mockSetDefaultView,
            setAutoCheckUpdates: mockSetAutoCheckUpdates,
        });
    });

    it('renders when open', () => {
        render(<SettingsModal open={true} onOpenChange={vi.fn()} />);
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<SettingsModal open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('calls setTheme on change', () => {
        render(<SettingsModal open={true} onOpenChange={vi.fn()} />);
        const select = screen.getAllByRole('combobox')[0]; // Theme is first
        fireEvent.change(select, { target: { value: 'dark' } });
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('calls setAutoCheckUpdates on toggle', () => {
        render(<SettingsModal open={true} onOpenChange={vi.fn()} />);
        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);
        expect(mockSetAutoCheckUpdates).toHaveBeenCalledWith(false);
    });
});
