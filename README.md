<img src="https://github.com/user-attachments/assets/68145096-c21c-457b-b084-1d226dd14caa" width="250" height="250">
<img width="470" height="252" alt="image" src="https://github.com/user-attachments/assets/193ff9f5-e419-40f8-b247-b68bbc57eb60" />

# Generative AI Studio
High-performance media workflow app for Generative AI teams.

## Features
- **Fast Media Browsing**: Virtualized grid view for handling thousands of assets.
- **Advanced Viewing**: Zoom and pan support for detailed inspection.
- **Organization**: Assign Project, Scene, and Shot metadata.
- **Workflow Status**: Track asset status (Unsorted, Review Requested, Approved, etc.).
- **Collaboration**: Sync metadata across users via shared storage (e.g., Google Drive).
- **Multi-Selection**: Bulk update status for multiple assets.

## Tech Stack
- **Electron**: Cross-platform desktop runtime.
- **React + Vite**: Fast frontend development.
- **TypeScript**: Type safety.
- **Zustand**: State management.
- **Tailwind CSS**: Utility-first styling.

- **Better-SQLite3**: Local indexing and caching.

## Development

### Prerequisites
- Node.js (v18+)
- npm

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running
- **Development**:
  ```bash
  npm run dev:electron
  ```
  This runs both the Vite dev server and the Electron main process.

- **Testing**:
  ```bash
  npm run test
  ```
  Runs unit and integration tests using Vitest.

- **Build**:
  ```bash
  npm run build
  ```
  Builds the app for production.

## Project Structure
- `electron/`: Main process code (Indexer, DB).
- `src/`: Renderer process code (React components, Store).
- `src/components/`: UI components (Explorer, AssetCard, etc.).
- `src/store.ts`: Zustand store for global state.
