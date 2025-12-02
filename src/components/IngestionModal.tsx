import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Loader2, FileIcon } from 'lucide-react';

export const IngestionModal: React.FC = () => {
    const { ingestion, cancelIngestion, handleUpload } = useStore();
    const [project, setProject] = useState('');
    const [scene, setScene] = useState('');
    const [tags, setTags] = useState('');

    // Reset form when opening
    useEffect(() => {
        if (ingestion.isOpen) {
            setProject('');
            setScene('');
            setTags('');

            // Basic inference from first file
            if (ingestion.pendingFiles.length > 0) {
                const firstFile = ingestion.pendingFiles[0];
                // Example: "ProjectA_Scene1_Shot3.mp4"
                const parts = firstFile.name.split('_');
                if (parts.length >= 2) {
                    setProject(parts[0]);
                    setScene(parts[1]);
                }
            }
        }
    }, [ingestion.isOpen, ingestion.pendingFiles]);

    const handleSave = async () => {
        await handleUpload({
            project,
            scene,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        });
    };

    return (
        <Dialog open={ingestion.isOpen} onOpenChange={(open) => !open && cancelIngestion()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Ingest Media ({ingestion.pendingFiles.length} files)</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="max-h-[150px] overflow-y-auto rounded-md border p-2 bg-muted/50">
                        {ingestion.pendingFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm py-1">
                                <FileIcon size={14} />
                                <span className="truncate">{file.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(1)} MB
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="project">Project</Label>
                        <Input
                            id="project"
                            value={project}
                            onChange={e => setProject(e.target.value)}
                            placeholder="e.g. Commercial_2024"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="scene">Scene</Label>
                        <Input
                            id="scene"
                            value={scene}
                            onChange={e => setScene(e.target.value)}
                            placeholder="e.g. Scene_01"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="tags">Tags (comma separated)</Label>
                        <Input
                            id="tags"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            placeholder="outdoor, day, drone"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={cancelIngestion} disabled={ingestion.isUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={ingestion.isUploading}>
                        {ingestion.isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            'Start Ingestion'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
