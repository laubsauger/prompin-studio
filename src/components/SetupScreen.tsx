import React, { useState } from 'react';
import { useSettingsStore } from '../store/settings';
import { useStore } from '../store';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Sparkles, FolderOpen, Zap, Users, Shield } from 'lucide-react';
import { Logo } from './Logo';

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
            <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 text-foreground p-8 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
                <div className="max-w-lg w-full space-y-8" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="w-32 h-32 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl flex items-center justify-center shadow-2xl">
                                <Logo className="w-20 h-20" />
                            </div>
                            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary animate-pulse" />
                        </div>
                    </div>

                    <div className="text-center space-y-3">
                        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            Welcome to Prompin' Studio
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-md mx-auto">
                            Your creative AI workflow companion for managing and organizing generative media assets
                        </p>
                    </div>

                    <div className="space-y-6 pt-4">
                        <div className="space-y-3">
                            <Input
                                id="userName"
                                placeholder="Enter your name..."
                                value={userName}
                                onChange={(e) => setUserNameLocal(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUserSetup()}
                                autoFocus
                                className="h-14 text-base px-4 mt-2"
                            />
                            <p className="text-sm text-muted-foreground">
                                This will be used as the author when you add media to the collection
                            </p>
                        </div>

                        <Button
                            onClick={handleUserSetup}
                            disabled={!userName.trim()}
                            className="w-full h-14 text-base font-medium"
                            size="lg"
                        >
                            Continue
                        </Button>

                        <div className="pt-6 border-t">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="space-y-2">
                                    <div className="w-10 h-10 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Zap className="w-5 h-5 text-primary" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Lightning Fast</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="w-10 h-10 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Team Ready</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="w-10 h-10 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-primary" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Secure & Local</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 text-foreground p-8 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="max-w-lg w-full text-center space-y-8" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="w-32 h-32 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl flex items-center justify-center shadow-2xl">
                            <Logo className="w-20 h-20" />
                        </div>
                        <FolderOpen className="absolute -bottom-2 -right-2 w-8 h-8 text-primary" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-4xl font-bold tracking-tight">Select Your Media Folder</h1>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                        Choose the folder containing your creative assets. This can be a local folder or a synced cloud storage location.
                    </p>
                </div>

                <div className="space-y-4 pt-4">
                    <Button
                        onClick={handleSelectFolder}
                        className="h-14 px-12 text-base font-medium"
                        size="lg"
                    >
                        <FolderOpen className="mr-2 h-5 w-5" />
                        Browse for Folder
                    </Button>

                    <div className="pt-4 space-y-3">
                        <p className="text-sm text-muted-foreground">Supports:</p>
                        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                            <span>• Local Folders</span>
                            <span>• Network Drives</span>
                            <span>• Google Drive</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setStep('user')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
                >
                    ← Back
                </button>
            </div>
        </div>
    );
};
