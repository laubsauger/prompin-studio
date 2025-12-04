# System Architecture

## Overview
Prompin Studio is a desktop application built with **Electron**, **React**, and **TypeScript**. It serves as a workflow support tool for Generative AI studios, managing media assets (images, videos), their metadata, and lineage.

## Technology Stack
- **Frontend**: React, Zustand (State Management), Tailwind CSS, Shadcn UI.
- **Backend (Electron Main Process)**: Node.js, Better-SQLite3 (Database), Fluent-FFmpeg (Media Processing).
- **Communication**: Electron IPC (Inter-Process Communication).
- **Testing**: Vitest, React Testing Library.

## Core Components

### 1. Electron Main Process (`electron/main.ts`)
- Entry point of the application.
- Manages application windows and lifecycle.
- Registers custom protocols (`media://`, `thumbnail://`) for secure file access.
- Sets up IPC handlers to expose backend services to the renderer.

### 2. Indexer Service (`electron/services/IndexerService.ts`)
- The "brain" of the backend.
- **File Watching**: Uses `chokidar` to watch the root directory for file changes.
- **Thumbnail Generation**: Generates thumbnails for images and videos using `ffmpeg`.
- **Search & Filtering**: Executes SQL queries to filter and sort assets.

### 3. Data Storage
- **SQLite Database**: Stores asset metadata, tags, and embeddings.
    - Location: `userData/prompin-studio.db`
    - Extensions: `sqlite-vec` for vector search.
- **Sync Folder**: Stores event logs for multiplayer.
    - Location: `ProjectRoot/.prompin-studio/events/`

### 4. Renderer Process (Frontend)
- **Store (`src/store.ts`)**: Global state management using `zustand`. Handles assets, selection, filters, and UI state. Acts as the bridge between UI components and the backend via IPC.
- **Components**:
    - `Explorer`: Main grid view of assets.
    - `Sidebar`: Navigation, filters, tags, and scratch pads.
    - `MetadataEditor`: Dialog for viewing and editing asset metadata.
    - `IngestionModal`: Interface for importing new files.
    - `LineageView`: Visualizes relationships between assets.

## Data Flow

1.  **Initialization**:
    - App starts, `IndexerService` initializes DB and starts watching the root folder.
    - Frontend loads, calls `get-assets` IPC to fetch initial data.

2.  **File System Changes**:
    - User adds a file to the watched folder.
    - `chokidar` detects the add event.
    - `IndexerService` indexes the file, generates a thumbnail, and updates the DB.
    - (Future) `IndexerService` emits an event to the frontend to update the view (currently polled or refreshed on action).

3.  **User Actions (e.g., Tagging)**:
    - User clicks a tag in `AssetContextMenu`.
    - Component calls `addTagToAsset` in `store.ts`.
    - Store invokes `add-tag-to-asset` IPC.
    - `IndexerService` updates the SQLite many-to-many relationship.
    - Store re-fetches assets/tags to update the UI.

## Database Schema
- **assets**: Stores file path, type, metadata (JSON blob), timestamps.
- **tags**: Stores tag definitions (name, color).
- **asset_tags**: Junction table linking assets and tags.
- **folder_settings**: Stores folder-specific settings (e.g., colors).
