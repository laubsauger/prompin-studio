import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Loader2, FileIcon } from 'lucide-react';
import { MetadataForm } from './MetadataForm';
import type { AssetMetadata } from '../types';

export const IngestionModal: React.FC = () => {
    const { ingestion, cancelIngestion, handleUpload } = useStore();
    const [metadata, setMetadata] = useState<AssetMetadata>({} as AssetMetadata);
    const [tags, setTags] = useState<string[]>([]);
    const [destination, setDestination] = useState('');

    // Reset form when opening
    useEffect(() => {
        if (ingestion.isOpen) {
            setMetadata({} as AssetMetadata);
            setTags([]);
            setDestination(ingestion.targetPath || '');

            // Basic inference from first file
            if (ingestion.pendingFiles.length > 0) {
                const firstFile = ingestion.pendingFiles[0];
                // Example: "ProjectA_Scene1_Shot3.mp4"
                const parts = firstFile.name.split('_');
                if (parts.length >= 2) {
                    setMetadata(prev => ({
                        ...prev,
                        project: parts[0],
                        scene: parts[1]
                    }));
                }
            }
        }
    }, [ingestion.isOpen, ingestion.pendingFiles, ingestion.targetPath]);

    const handleSave = async () => {
        await handleUpload({
            ...metadata,
            project: metadata.project || '',
            scene: metadata.scene || '',
            tags: tags, // Pass tag IDs
            targetPath: destination
        });
    };

    return (
        <Dialog open={ingestion.isOpen} onOpenChange={(open) => !open && cancelIngestion()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle>Ingest Media ({ingestion.pendingFiles.length} files)</DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Column: File List */}
                    <div className="w-1/3 border-r bg-muted/30 p-6 flex flex-col gap-4 overflow-y-auto">
                        <div className="space-y-2">
                            <Label htmlFor="destination">Destination Folder</Label>
                            <Input
                                id="destination"
                                value={destination}
                                onChange={e => setDestination(e.target.value)}
                                placeholder="Uploads"
                            />
                            <p className="text-[10px] text-muted-foreground">Leave empty for default Uploads folder</p>
                        </div>

                        <div className="flex-1 overflow-y-auto rounded-md border p-2 bg-background">
                            {ingestion.pendingFiles.map((file, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                                    <FileIcon size={14} className="shrink-0" />
                                    <span className="truncate">{file.name}</span>
                                    <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                                        {(file.size / 1024 / 1024).toFixed(1)} MB
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Metadata Form */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <MetadataForm
                            initialMetadata={metadata}
                            onChange={setMetadata}
                            tags={tags}
                            onTagsChange={setTags}
                        />
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10">
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
