/**
 * Infers the AI platform from a given URL
 */
export function inferPlatformFromUrl(url?: string): string | undefined {
    if (!url) return undefined;

    const urlLower = url.toLowerCase();

    // MidJourney
    if (urlLower.includes('midjourney.com') || urlLower.includes('discord.com')) {
        return 'MidJourney';
    }

    // OpenAI / DALL-E
    if (urlLower.includes('openai.com') || urlLower.includes('dall-e')) {
        return 'DALL-E';
    }

    // Stable Diffusion / DreamStudio
    if (urlLower.includes('dreamstudio.ai') || urlLower.includes('stability.ai')) {
        return 'Stable Diffusion';
    }

    // Runway
    if (urlLower.includes('runway.ml') || urlLower.includes('runwayml.com')) {
        return 'Runway';
    }

    // Leonardo.ai
    if (urlLower.includes('leonardo.ai')) {
        return 'Leonardo.ai';
    }

    // Civitai
    if (urlLower.includes('civitai.com')) {
        return 'Civitai';
    }

    // Ideogram
    if (urlLower.includes('ideogram.ai')) {
        return 'Ideogram';
    }

    // Adobe Firefly
    if (urlLower.includes('firefly.adobe.com')) {
        return 'Adobe Firefly';
    }

    // Bing Image Creator
    if (urlLower.includes('bing.com/create')) {
        return 'Bing Image Creator';
    }

    // Pika Labs
    if (urlLower.includes('pika.art')) {
        return 'Pika';
    }

    // HuggingFace
    if (urlLower.includes('huggingface.co')) {
        return 'HuggingFace';
    }

    return undefined;
}

/**
 * Validates if a URL is a valid platform URL
 */
export function isValidPlatformUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}