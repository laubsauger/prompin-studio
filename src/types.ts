export type AssetStatus = 'unsorted' | 'review_requested' | 'pending' | 'approved' | 'archived' | 'offline' | 'tagged';

export interface Asset {
    id: string;
    path: string; // Relative to project root
    type: 'image' | 'video' | 'other';
    status: AssetStatus;
    createdAt: number;
    updatedAt: number;
    metadata: AssetMetadata;
    thumbnailPath?: string;
    tags?: { id: string; name: string; color?: string }[];
}

export interface AssetMetadata {
    width?: number;
    height?: number;
    duration?: number;
    prompt?: string;
    seed?: number;
    model?: string;
    authorId?: string;
    project?: string;
    scene?: string;
    shot?: string;
    comments?: Comment[];
    liked?: boolean;
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
    status: 'idle' | 'scanning' | 'syncing';
    lastSync: number;
    thumbnailsGenerated?: number;
    thumbnailsFailed?: number;
    errors?: Array<{ file: string; error: string; timestamp: number }>;
    filesByType?: { images: number; videos: number; other: number };
}
