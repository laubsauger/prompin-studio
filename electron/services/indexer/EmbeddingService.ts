
import { env, RawImage, AutoTokenizer, AutoProcessor, CLIPVisionModelWithProjection, CLIPTextModelWithProjection } from '@xenova/transformers';
import { app, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs/promises';

// Configure cache directory for models
// We use a dedicated directory in userData to ensure persistence and access
env.cacheDir = path.join(app.getPath('userData'), 'models_cache');
env.allowLocalModels = false; // We want to download from Hub initially

class EmbeddingService {
    private tokenizer: any = null;
    private processor: any = null;
    private visionModel: any = null;
    private textModel: any = null;

    // Switch to CLIP model for multimodal (image + text) embeddings
    private modelName = 'Xenova/clip-vit-base-patch32';
    private isInitializing = false;

    constructor() {
    }

    async init() {
        if (this.visionModel && this.textModel) return;
        if (this.isInitializing) {
            // Wait for initialization
            while (this.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.visionModel && this.textModel) return;
        }

        this.isInitializing = true;
        try {
            console.log('[EmbeddingService] Loading model:', this.modelName);

            // Load tokenizer, processor, and models
            // We load vision and text models separately to avoid input conflicts
            const [tokenizer, processor, visionModel, textModel] = await Promise.all([
                AutoTokenizer.from_pretrained(this.modelName),
                AutoProcessor.from_pretrained(this.modelName),
                CLIPVisionModelWithProjection.from_pretrained(this.modelName),
                CLIPTextModelWithProjection.from_pretrained(this.modelName)
            ]);

            this.tokenizer = tokenizer;
            this.processor = processor;
            this.visionModel = visionModel;
            this.textModel = textModel;

            console.log('[EmbeddingService] Models loaded successfully');
        } catch (error) {
            console.error('[EmbeddingService] Failed to load models:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Generate embedding for text or image.
     * @param input Text string or absolute path to image file
     */
    async generateEmbedding(input: string): Promise<number[] | null> {
        try {
            if (!input || input.trim().length === 0) return null;

            if (!this.visionModel || !this.textModel) await this.init();

            // Check if input is likely a file path (for images)
            const isImagePath = path.isAbsolute(input) && /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(input);

            let embedding: any;

            if (isImagePath) {
                try {
                    // Check file size first
                    const stats = await fs.stat(input);
                    if (stats.size === 0) {
                        console.warn(`[EmbeddingService] Skipping empty file: ${input} `);
                        return null;
                    }

                    let buffer: Buffer;

                    // Try nativeImage first (more robust for OS-specific paths/symlinks)
                    const nImage = nativeImage.createFromPath(input);
                    if (!nImage.isEmpty()) {
                        buffer = nImage.toPNG();
                    } else {
                        // Fallback to fs.readFile
                        buffer = await fs.readFile(input);
                    }

                    const blob = new Blob([buffer as any]);
                    const image = await RawImage.fromBlob(blob);

                    // Generate image embedding
                    const image_inputs = await this.processor(image);
                    const output = await this.visionModel(image_inputs);
                    embedding = output.image_embeds;

                } catch (e: any) {
                    if (e.code === 'ENOENT') {
                        console.warn(`[EmbeddingService] File not found: ${input} `);
                    } else if (e.message?.includes('unsupported image format')) {
                        console.warn(`[EmbeddingService] Unsupported image format: ${input} `);
                    } else {
                        console.warn(`[EmbeddingService] Failed to read / embed image at ${input}: `, e);
                    }
                    return null;
                }
            } else {
                // Generate text embedding
                const text_inputs = this.tokenizer([input], { padding: true, truncation: true });
                const output = await this.textModel(text_inputs);
                embedding = output.text_embeds;
            }

            if (!embedding) {
                console.warn(`[EmbeddingService] No embedding generated for ${input}`);
                return null;
            }

            // Normalize embedding (L2 normalization)
            // embedding is a Tensor (likely [1, 512])
            // We need to convert to array and normalize
            const rawData = Array.from(embedding.data) as number[];

            // Calculate L2 norm
            let sumSq = 0;
            for (const val of rawData) {
                sumSq += val * val;
            }
            const norm = Math.sqrt(sumSq);

            // Normalize
            const normalizedData = rawData.map(val => val / (norm || 1)); // Avoid div by zero

            console.log(`[EmbeddingService] Generated embedding for ${isImagePath ? 'Image' : 'Text'}: ${path.basename(input)} `);
            console.log(`[EmbeddingService] Preview: [${normalizedData.slice(0, 5).join(', ')}...](Norm: ${norm})`);

            return normalizedData;

        } catch (error) {
            console.error('[EmbeddingService] Error generating embedding:', error);
            return null;
        }
    }
}

export const embeddingService = new EmbeddingService();
