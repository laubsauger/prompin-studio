# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Generative AI Studio is a high-performance Electron-based media workflow application for managing generative AI production assets. It supports multi-user collaboration via shared storage (Google Drive), local caching with SQLite, and real-time file system watching.

## Development Commands

### Running the Application
- `npm run dev:electron` - Start both Vite dev server and Electron app (primary development command)
- `npm run dev` - Start Vite dev server only
- `npm run electron` - Start Electron (waits for Vite on port 5173)

### Building
- `npm run build` - Full production build (TypeScript → Vite → Electron build → electron-builder)
- `npm run build:electron` - Compile Electron main process TypeScript only

### Testing
- `npm test` - Run all Vitest tests (watch mode by default)
- `npm test -- --run` - Run tests once without watch mode
- `npm test -- path/to/test.test.ts` - Run specific test file
- Tests use jsdom environment and are set up in `src/test/setup.ts`
- Component tests: Mock Zustand store via `vi.mock('../store')`
- Electron tests: Mock `db.js` module with in-memory Map implementation

### Linting
- `npm run lint` - Run ESLint

## Architecture

### Process Model
**Electron Main Process** (`electron/main.ts`):
- Creates BrowserWindow with contextIsolation enabled
- Registers IPC handlers for asset operations, metadata updates, and file system operations
- Initializes IndexerService for file system watching

**Renderer Process** (`src/`):
- React 19 + TypeScript + Vite frontend
- Communicates with main process via preload-exposed IPC bridge (`window.ipcRenderer`)
- UI components in `src/components/`

### Data Flow
1. **File System → IndexerService → SQLite → IPC → Zustand Store → React Components**
2. IndexerService (`electron/services/IndexerService.ts`) watches the root folder via chokidar
3. Assets are indexed into SQLite (`electron/db.ts`) with metadata stored as JSON
4. IPC handlers expose asset queries and mutations to renderer
5. Zustand store (`src/store.ts`) manages frontend state with optimistic updates
6. Settings persist via separate Zustand store (`src/store/settings.ts`)

### Key Components
- **IndexerService**: File system watcher, asset discovery, metadata management
- **Database**: better-sqlite3 with WAL mode, stores assets with JSON metadata
- **Store**: Global Zustand state (assets, filters, selection, ingestion workflow)
- **Explorer**: Virtualized grid view (react-window) for performance with large asset libraries
- **AssetCard**: Individual asset display with status badges and actions
- **MediaViewer**: Full-screen asset viewer with zoom/pan (react-zoom-pan-pinch)

### Multi-User Collaboration
- Source of truth: Shared Google Drive folder with media files
- Local SQLite cache for performance
- Metadata changes propagate via file system (per-user metadata files to avoid conflicts)
- All file paths are relative to project root for cross-platform compatibility

### Type System
Core types in `src/types.ts`:
- `Asset`: id, path, type, status, timestamps, metadata
- `AssetStatus`: unsorted | review_requested | pending | approved | archived | offline
- `AssetMetadata`: prompt, seed, model, authorId, project/scene/shot hierarchy, comments, liked
- `SyncStats`: file counts, sync status tracking

## Testing Requirements
Per `AGENTS.md`: Any new functionality or changes MUST include updated unit/integration tests. Tasks are not complete until tests pass.

## UI Frameworks
- **Styling**: Tailwind CSS (v4) with `@tailwindcss/postcss`
- **Components**: Radix UI primitives (Dialog, Label, Switch, Slot)
- **Animations**: Framer Motion for transitions
- **Icons**: lucide-react

## Important Constraints
- **Performance**: Ultra-fast browsing is paramount; virtualization and caching are critical
- **Data Safety**: Multi-file approach preferred over monolithic databases to avoid sync conflicts
- **Path Handling**: Always use relative paths from project root for cross-platform compatibility
- **IPC**: All main process communication uses typed IPC handlers; mock IPC in tests via `window.ipcRenderer`
- **Optimistic Updates**: UI updates immediately, then syncs with backend via IPC
