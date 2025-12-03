# Ingestion Workflow

## Overview
The ingestion process allows users to import external media files into the studio's managed workspace. It handles file copying, metadata assignment, and tag application.

## Workflow Steps

### 1. User Interaction (`IngestionModal.tsx`)
- User opens the Ingestion Dialog (via "File > Ingest" or drag-and-drop).
- User drops files onto the drop zone.
- **Initial Inference**: The app attempts to infer `project` and `scene` metadata from the filename of the first file (e.g., `ProjectA_Scene1_Shot3.mp4`).
- User fills in the `MetadataForm`:
    - **Destination**: Target folder within the workspace.
    - **Metadata**: Project, Scene, Description, Author.
    - **Tags**: Selects existing tags or creates new ones.

### 2. Submission (`store.ts`)
- User clicks "Ingest".
- `IngestionModal` calls `handleUpload` action in the store.
- `handleUpload` prepares the metadata object, ensuring all fields are correctly typed.

### 3. File Upload (`services/uploadService.ts`)
- The store iterates through the pending files.
- For each file, `uploadService.uploadFile` is called.
- **File Copy**: The file is copied from the source path to the target path in the workspace.
- **Metadata Write**: (Currently, metadata is stored in the DB, but in the future, it could be written to XMP/Sidecar files).
- The service returns the newly created `Asset` object (fetched from the backend after the file watcher detects it).

### 4. Tag Application (`store.ts`)
- After successful upload, `handleUpload` iterates through the selected tags.
- It calls `add-tag-to-asset` IPC for each tag and the new asset ID.
- This ensures that newly ingested assets immediately have the correct tags.

### 5. UI Update
- The store optimistically updates the local asset list to include the new files.
- The Ingestion Dialog closes.
- A "Resync" might be triggered to ensure full consistency with the backend.

## Key Components
- **`IngestionModal`**: The UI for collecting files and metadata.
- **`MetadataForm`**: Reusable form for editing metadata (shared with Editor).
- **`uploadService`**: Handles the physical file operations.
- **`IndexerService`**: Detects the new file and creates the initial DB record.
