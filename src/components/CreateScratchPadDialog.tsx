import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CreateScratchPadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
}

export const CreateScratchPadDialog: React.FC<CreateScratchPadDialogProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onCreate(name.trim());
            setName('');
            onClose();
        }
    };

    const handleClose = () => {
        setName('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Scratch Pad</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="scratch-pad-name">Name</Label>
                            <Input
                                id="scratch-pad-name"
                                placeholder="Enter scratch pad name..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                className="mt-2"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim()}>
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
