# Generative AI Studio

High-performance media workflow app for Generative AI teams.

## Getting Started

### Prerequisites
- Node.js (v18+)
- NPM

### Installation
```bash
npm install
```

### Development
Run the app in development mode (Vite + Electron):
```bash
npm run dev:electron
```

### Build
Build for production (Mac/Windows/Linux):
```bash
npm run build
```
The output will be in the `dist` directory.

## Architecture
- **Electron Main**: Handles file system access, indexing (SQLite), and window management.
- **Renderer**: React app for the UI.
- **Sync**: Metadata is synced via shared files on Google Drive (simulated via file system watch).

## Testing
- **Unit Tests**: `npm run test` (Coming soon)
- **E2E Tests**: `npm run test:e2e` (Coming soon)
