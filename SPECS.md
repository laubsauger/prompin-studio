# Generative AI Studio - Specifications

## Overview
A high-performance, cross-platform media explorer and workflow tool for generative AI production. It manages assets across a shared Google Drive folder, supporting multi-user collaboration with robust conflict resolution.

## Core Features

### 1. Media Explorer
- **Performance**: Ultra-fast browsing with local caching (thumbnails, metadata).
- **Sources**: Supports network shares and Google Drive.
- **Lineage**: Tracks relationships (Input -> Output, e.g., Image -> Video).
- **Filtering**: By project, folder, author, tags, and status.

### 2. Workflow & Collaboration
- **Multiplayer**: Syncs metadata between users via Google Drive.
- **Conflict Resolution**: "Per-user" metadata files to avoid merge conflicts.
- **Roles**:
    - **Admin**: Can manage projects and user roles.
    - **Editor**: Can add/edit media and metadata.
    - **Viewer**: Read-only access.
- **Media Status**:
    - `Unsorted` (Default)
    - `Requesting Review`
    - `Pending Approval`
    - `Approved / Pick`
    - `Archived`
    - `Offline`
- **Review Process**:
    - Reviewers can filter by `Requesting Review`.
    - Can Approve/Reject (change status).
    - Can leave **Comments** on assets.

### 3. Organization
- **Hierarchy**: `Project` > `Scene` > `Shot`.
- **Assignment**: Assets can be assigned to these entities via metadata.
- **Folders**: Customizable with titles, icons, and subtitles.
- **Prompt Library**: Tagged and searchable prompts.

### 4. Sync & Operations
- **Manual Resync**: Trigger scan on demand.
- **Stats**: View total files, progress, and current status.

## Data Model

### Asset
```typescript
interface Asset {
  id: string;
  path: string;
  type: 'image' | 'video' | 'other';
  status: 'unsorted' | 'review_requested' | 'pending' | 'approved' | 'archived';
  metadata: {
    prompt?: string;
    authorId: string;
    inputs?: string[]; // IDs of input assets
  };
}
```

### User
```typescript
interface User {
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
}
```

## Tech Stack
- **Electron**: Desktop runtime.
- **React + Vite**: Frontend.
- **SQLite**: Local caching.
- **File System**: Source of truth for media files.
