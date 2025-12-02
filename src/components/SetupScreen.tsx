import React from 'react';
import { useSettingsStore } from '../store/settings';
import { useStore } from '../store';

export const SetupScreen: React.FC = () => {
    const setRootFolder = useSettingsStore(state => state.setRootFolder);
    const setRootPath = useStore(state => state.setRootPath);

    const handleSelectFolder = async () => {
        // We need to access ipcRenderer directly or via store helper
        // Since store.ts has the mock logic, let's use a store action if possible, 
        // or just access window.ipcRenderer if we trust our environment.
        // But better to use the store action I'm about to create.
        const path = await setRootPath();
        if (path) {
            setRootFolder(path);
        }
    };

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-8">
            <div className="max-w-md text-center space-y-6">
                <div className="flex justify-center mb-8">
                    {/* Placeholder for Logo or Icon */}
                    <div className="w-24 h-24 bg-primary/20 rounded-2xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-primary">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                </div>

                <h1 className="text-3xl font-bold tracking-tight">Welcome to Gen Studio</h1>
                <p className="text-muted-foreground text-lg">
                    To get started, please select a folder where your media assets are located.
                </p>

                <button
                    onClick={handleSelectFolder}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 py-6 text-lg"
                >
                    Open Folder
                </button>
            </div>
        </div>
    );
};
