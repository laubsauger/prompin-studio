import React, { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useStore } from '../store';

export const DragDropOverlay: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const { startIngestion, ingestion } = useStore();

    useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer?.types.includes('Files')) {
                setIsDragging(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            // Only hide if we're leaving the window
            if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                setIsDragging(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                startIngestion(files);
            }
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, [startIngestion]);

    if (!isDragging || ingestion.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary m-4 rounded-xl">
            <div className="flex flex-col items-center gap-4 text-primary animate-bounce">
                <UploadCloud size={64} />
                <h2 className="text-2xl font-bold">Drop files to ingest</h2>
            </div>
        </div>
    );
};
