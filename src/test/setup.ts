import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Electron IPC
(window as any).require = (module: string) => {
    if (module === 'electron') {
        return {
            ipcRenderer: {
                invoke: vi.fn(),
                on: vi.fn(),
                removeListener: vi.fn(),
            },
        };
    }
    return {};
};
