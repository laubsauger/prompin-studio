/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

class IntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
}

class ResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
}

if (typeof window !== 'undefined') {
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

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    Object.defineProperty(window, 'IntersectionObserver', {
        writable: true,
        configurable: true,
        value: IntersectionObserver,
    });

    Object.defineProperty(window, 'ResizeObserver', {
        writable: true,
        configurable: true,
        value: ResizeObserver,
    });
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: IntersectionObserver,
});

Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserver,
});
