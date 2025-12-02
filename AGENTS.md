# AGENTS.md

## Project Philosophy
This project, "Generative AI Studio", is a high-performance, cross-platform media management and workflow tool designed for generative AI production pipelines.

### Core Values
1.  **Performance is Paramount**: The explorer must be "ultra fast". Caching strategies (thumbnails, metadata) are critical. It must handle network shares and Google Drive folders without lagging.
2.  **Robustness & Data Safety**: The system relies on a shared Google Drive folder. It must handle multi-user concurrency without data loss. We prefer a "multi-file" approach (e.g., per-user metadata files) over a single monolithic database file to avoid sync conflicts.
3.  **Discoverability**: The chaos of file-based workflows is the enemy. Tags, relations (inputs -> outputs), and lineage tracking are key features.
4.  **Aesthetics**: The UI should be modern, "premium", and responsive. Use rich aesthetics, dark modes, and smooth animations.

### Tech Stack
- **Runtime**: Electron (for cross-platform desktop capabilities and local file system access).
- **Frontend**: React + TypeScript + Vite.
- **Styling**: Vanilla CSS (or Tailwind if requested, but default to Vanilla for control as per system prompt, though user mentioned "modern web tech" so we can be flexible). *Self-correction: System prompt says "Avoid using TailwindCSS unless the USER explicitly requests it". I will stick to Vanilla CSS or CSS Modules.*
- **Backend/Logic**: Node.js (within Electron main/utility processes).
- **Data**: SQLite (local cache) + JSON/YAML (shared state on Drive).

### Agent Instructions
- When implementing features, always consider the "Multiplayer" aspect. How does this change propagate to other users?
- Prioritize non-destructive edits.
- Ensure all media paths are relative to the "Project Root" (the shared Drive folder) so they work across different machines where the drive might be mounted at different paths (e.g., `X:\` vs `/Volumes/GoogleDrive`).
