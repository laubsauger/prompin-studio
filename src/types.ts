export type AssetStatus = 'unsorted' | 'review_requested' | 'pending' | 'approved' | 'archived' | 'offline';

export interface Asset {
    id: string;
    path: string; // Relative to project root
    rootPath?: string; // Absolute root path (optional for backward compatibility/frontend usage where context is implied)
    type: 'image' | 'video' | 'other';
    status: AssetStatus;
    createdAt: number;
    updatedAt: number;
    metadata: AssetMetadata;
    thumbnailPath?: string;
    tags?: { id: string; name: string; color?: string }[];
    distance?: number; // Similarity distance (lower is better)
}

export interface AssetMetadata {
    width?: number;
    height?: number;
    duration?: number;
    fileSize?: number;
    prompt?: string;
    seed?: number;
    model?: string;
    platform?: string; // AI platform (e.g., "MidJourney", "DALL-E", "Stable Diffusion") - can be inferred from platformUrl
    platformUrl?: string; // Direct link to the asset on the platform (e.g., MidJourney gallery URL)
    authorId?: string;
    project?: string;
    scene?: string;
    shot?: string;
    comments?: Comment[];
    liked?: boolean;
    inputs?: string[]; // IDs of input assets
    embedding?: number[];
    description?: string;
    tags?: string[]; // Extracted tags from metadata
}

export interface Comment {
    id: string;
    authorId: string;
    text: string;
    timestamp: number;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
    id: string;
    name: string;
    role: UserRole;
}

export interface Project {
    id: string;
    name: string;
    path: string; // Relative to root
}

export interface Folder {
    id: string;
    path: string;
    title?: string;
    icon?: string;
}

export interface SyncStats {
    totalFiles: number;
    processedFiles: number;
    totalFolders?: number;
    status: 'idle' | 'scanning' | 'syncing' | 'indexing';
    lastSync: number;
    thumbnailsGenerated?: number;
    thumbnailsFailed?: number;
    errors?: Array<{ file: string; error: string; timestamp: number }>;
    filesByType?: { images: number; videos: number; other: number };
    skippedFiles?: number;
    currentFile?: string;
    thumbnailProgress?: {
        current: number;
        total: number;
    };
    embeddingProgress?: {
        current: number;
        total: number;
    };
    embeddingsGenerated?: number;
}
