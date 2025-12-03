import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';

export class Watcher extends EventEmitter {
    private watcher: FSWatcher | null = null;

    constructor() {
        super();
    }

    public start(rootPath: string) {
        this.stop();

        console.log(`[Watcher] Starting on ${rootPath}`);
        this.watcher = watch(rootPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            depth: 99,
            followSymlinks: true,
            usePolling: true,
            interval: 2000,
            binaryInterval: 2000,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', (path) => this.emit('add', path))
            .on('addDir', (path) => this.emit('addDir', path))
            .on('unlinkDir', (path) => this.emit('unlinkDir', path))
            .on('change', (path) => this.emit('change', path))
            .on('unlink', (path) => this.emit('unlink', path))
            .on('ready', () => {
                console.log('[Watcher] Ready');
                this.emit('ready');
            });
    }

    public async stop() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}
