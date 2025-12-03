import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetadataForm } from './MetadataForm';
import React from 'react';

// Mock UI components that might cause issues in JSDOM
vi.mock('./ui/popover', () => ({
    Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PopoverTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ui/command', () => ({
    Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandInput: () => <input placeholder="Search..." />,
    CommandEmpty: () => <div>No results</div>,
    CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandItem: ({ children, onSelect }: { children: React.ReactNode, onSelect: () => void }) => (
        <div onClick={onSelect}>{children}</div>
    ),
    CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { useStore } from '../store';

// ... mocks ...

describe('MetadataForm', () => {
    const defaultProps = {
        initialMetadata: {},
        onChange: vi.fn(),
        onTagsChange: vi.fn(),
    };

    beforeEach(() => {
        useStore.setState({
            tags: [
                { id: 'tag-1', name: 'Tag 1', color: '#ff0000' },
                { id: 'tag-2', name: 'Tag 2', color: '#00ff00' }
            ],
            assets: []
        });
    });

    it('should render input fields', () => {
        render(<MetadataForm {...defaultProps} />);

        expect(screen.getByPlaceholderText('Project Name')).toBeInTheDocument(); // Project
        expect(screen.getByPlaceholderText('Scene Name')).toBeInTheDocument(); // Scene
        expect(screen.getByPlaceholderText('Generation prompt...')).toBeInTheDocument(); // Prompt
    });

    it('should call onChange when inputs change', () => {
        render(<MetadataForm {...defaultProps} />);

        const projectInput = screen.getByPlaceholderText('Project Name');
        fireEvent.change(projectInput, { target: { value: 'New Project' } });

        expect(defaultProps.onChange).toHaveBeenCalledWith(expect.objectContaining({
            project: 'New Project'
        }));
    });

    it('should render tags correctly', () => {
        render(<MetadataForm {...defaultProps} tags={['tag-1']} />);

        // Since we mocked CommandItem, we check if the text is present
        // It might be present multiple times (dropdown + badge), which is fine
        expect(screen.getAllByText('Tag 1').length).toBeGreaterThan(0);
    });

    it('should call onTagsChange when a tag is selected', () => {
        render(<MetadataForm {...defaultProps} />);

        // Simulate clicking a tag (mocked CommandItem)
        const tagItem = screen.getByText('Tag 1');
        fireEvent.click(tagItem);

        expect(defaultProps.onTagsChange).toHaveBeenCalledWith(['tag-1']);
    });

    it('should call onTagsChange when a tag is deselected', () => {
        render(<MetadataForm {...defaultProps} tags={['tag-1']} />);

        const tagItems = screen.getAllByText('Tag 1');
        // The first one should be the CommandItem (mocked) or we can just click it
        fireEvent.click(tagItems[0]);

        expect(defaultProps.onTagsChange).toHaveBeenCalledWith([]);
    });
});
