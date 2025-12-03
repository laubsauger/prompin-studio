import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CreateTagDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateTag: (name: string, color?: string) => void | Promise<any>;
}

const TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
];

export const CreateTagDialog: React.FC<CreateTagDialogProps> = ({ isOpen, onClose, onCreateTag }) => {
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            await onCreateTag(name.trim(), selectedColor);
            // Close dialog after successful creation
            handleClose();
        }
    };

    const handleClose = () => {
        setName('');
        setSelectedColor(TAG_COLORS[0]);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Tag</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="tag-name">Tag Name</Label>
                            <Input
                                id="tag-name"
                                placeholder="Enter tag name..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                className="mt-2"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {TAG_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setSelectedColor(color)}
                                        className="w-8 h-8 rounded-md border-2 transition-all hover:scale-110"
                                        style={{
                                            backgroundColor: color,
                                            borderColor: selectedColor === color ? '#fff' : 'transparent',
                                            boxShadow: selectedColor === color ? '0 0 0 2px currentColor' : 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim()}>
                            Create Tag
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
