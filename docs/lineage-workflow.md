# Lineage Workflow

## Overview
Lineage tracking allows users to visualize the relationship between assets, such as "Source -> Render -> Composite". This helps in understanding the history and dependencies of a creative asset.

## Tracking Mechanism

### Current Implementation (Naming Convention)
Currently, lineage is primarily inferred or manually linked.
- **Inference**: (Planned) The system can infer lineage based on naming conventions (e.g., `Shot1_v1` -> `Shot1_v2`).
- **Explicit Linking**: Assets can store `parentId` or `sourceAssetId` in their metadata.

### Data Structure
The `Asset` interface includes fields for lineage:
```typescript
interface Asset {
    // ...
    metadata: {
        // ...
        parentId?: string; // ID of the parent asset
        generationParams?: any; // Parameters used to generate this asset
    }
}
```

## Visualization (`LineageView.tsx`)

### Graph Construction
1.  **Root Node**: The view starts with a selected asset as the focal point.
2.  **Ancestors**: It recursively fetches the parent of the current node until a root is found.
3.  **Descendants**: It searches for all assets where `parentId` equals the current node's ID.

### Rendering
- The graph is rendered as a tree structure.
- **`LineageNode`**: A recursive component that renders an `AssetCard` and its children.
- **Connectors**: SVG lines or CSS borders are used to visually connect parents to children.

## Future Improvements
- **Visual Graph Editor**: Allow users to drag-and-drop assets to establish lineage relationships.
- **Automatic Versioning**: Automatically detect and link new versions of a file.
