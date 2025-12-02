import React, { useState } from 'react';
import { useSettingsStore } from '../store/settings';
import { useStore } from '../store';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { User } from 'lucide-react';

export const SetupScreen: React.FC = () => {
    const [step, setStep] = useState<'user' | 'folder'>('user');
    const [userName, setUserNameLocal] = useState('');

    const setRootFolder = useSettingsStore(state => state.setRootFolder);
    const setUserName = useSettingsStore(state => state.setUserName);
    const setRootPath = useStore(state => state.setRootPath);

    const handleUserSetup = () => {
        if (userName.trim()) {
            setUserName(userName.trim());
            setStep('folder');
        }
    };

    const handleSelectFolder = async () => {
        const path = await setRootPath();
        if (path) {
            setRootFolder(path);
        }
    };

    if (step === 'user') {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-8">
                <div className="max-w-md w-full space-y-6">
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-24 bg-primary/20 rounded-2xl flex items-center justify-center">
                            <User className="w-12 h-12 text-primary" />
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Welcome to Gen Studio</h1>
                        <p className="text-muted-foreground text-lg">
                            Let's get to know you first
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="userName">Your Name</Label>
                            <Input
                                id="userName"
                                placeholder="Enter your name..."
                                value={userName}
                                onChange={(e) => setUserNameLocal(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUserSetup()}
                                autoFocus
                                className="h-12 text-base"
                            />
                            <p className="text-xs text-muted-foreground">
                                This will be used as the author when you add media to the collection
                            </p>
                        </div>

                        <Button
                            onClick={handleUserSetup}
                            disabled={!userName.trim()}
                            className="w-full h-12 text-base"
                        >
                            Continue
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-8">
            <div className="max-w-md text-center space-y-6">
                <div className="flex justify-center mb-8">
                    <div className="w-24 h-24 bg-primary/20 rounded-2xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-primary">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                </div>

                <h1 className="text-3xl font-bold tracking-tight">Select Your Media Folder</h1>
                <p className="text-muted-foreground text-lg">
                    Choose the folder where your media assets are located
                </p>

                <Button
                    onClick={handleSelectFolder}
                    className="h-12 px-8 text-base"
                >
                    Open Folder
                </Button>

                <button
                    onClick={() => setStep('user')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    ← Back
                </button>
            </div>
        </div>
    );
};
