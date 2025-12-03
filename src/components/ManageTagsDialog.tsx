import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Trash2, Plus } from 'lucide-react';
import { useStore } from '../store';
import { CreateTagDialog } from './CreateTagDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './ui/alert-dialog';

interface ManageTagsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ManageTagsDialog: React.FC<ManageTagsDialogProps> = ({ isOpen, onClose }) => {
    const tags = useStore(state => state.tags);
    const deleteTag = useStore(state => state.deleteTag);
    const createTag = useStore(state => state.createTag);
    const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
    const [tagToDelete, setTagToDelete] = useState<{ id: string; name: string } | null>(null);

    const handleDeleteTag = async () => {
        if (tagToDelete) {
            await deleteTag(tagToDelete.id);
            setTagToDelete(null);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Manage Tags</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {tags.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No tags yet. Create your first tag!
                            </p>
                        ) : (
                            tags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded-full border"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="font-medium">{tag.name}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setTagToDelete({ id: tag.id, name: tag.name })}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>

                    <Button
                        onClick={() => setIsCreateTagOpen(true)}
                        variant="outline"
                        className="w-full"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Tag
                    </Button>
                </DialogContent>
            </Dialog>

            <CreateTagDialog
                isOpen={isCreateTagOpen}
                onClose={() => setIsCreateTagOpen(false)}
                onCreateTag={async (name, color) => {
                    await createTag(name, color);
                }}
            />

            <AlertDialog open={!!tagToDelete} onOpenChange={() => setTagToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the tag "{tagToDelete?.name}"?
                            This will remove it from all assets.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteTag}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};