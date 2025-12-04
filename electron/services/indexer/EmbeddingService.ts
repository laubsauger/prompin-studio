import { pipeline, env } from '@xenova/transformers';
import { app } from 'electron';
import path from 'path';

// Configure cache directory for models
// We use a dedicated directory in userData to ensure persistence and access
env.cacheDir = path.join(app.getPath('userData'), 'models_cache');
env.allowLocalModels = false; // We want to download from Hub initially

class EmbeddingService {
    private pipe: any = null;
    private modelName = 'Xenova/all-MiniLM-L6-v2';
    private isInitializing = false;

    constructor() {
    }

    async init() {
        if (this.pipe) return;
        if (this.isInitializing) {
            // Wait for initialization
            while (this.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.pipe) return;
        }

        this.isInitializing = true;
        try {
            console.log('[EmbeddingService] Loading model:', this.modelName);
            this.pipe = await pipeline('feature-extraction', this.modelName);
            console.log('[EmbeddingService] Model loaded successfully');
        } catch (error) {
            console.error('[EmbeddingService] Failed to load model:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    async generateEmbedding(text: string): Promise<number[] | null> {
        try {
            if (!text || text.trim().length === 0) return null;

            if (!this.pipe) await this.init();

            // Generate embedding
            const output = await this.pipe(text, { pooling: 'mean', normalize: true });

            // Convert Float32Array to regular array
            return Array.from(output.data);
        } catch (error) {
            console.error('[EmbeddingService] Error generating embedding:', error);
            return null;
        }
    }
}

export const embeddingService = new EmbeddingService();
