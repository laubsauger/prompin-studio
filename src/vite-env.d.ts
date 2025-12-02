/// <reference types="vite/client" />

export { };


declare global {
    interface Window {
        ipcRenderer: {
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            on: (channel: string, func: (...args: any[]) => void) => void;
            off: (channel: string, func: (...args: any[]) => void) => void;
        };
    }
}
