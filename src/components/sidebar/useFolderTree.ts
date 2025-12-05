import { useMemo } from 'react';
import { useStore } from '../../store';

export interface TreeNode {
    name: string;
    path: string;
    children: Record<string, TreeNode>;
    count: number;
}

export const useFolderTree = () => {
    const folders = useStore(state => state.folders);
    const assets = useStore(state => state.assets);

    const folderTree = useMemo(() => {
        const root: TreeNode = { name: 'Root', path: '', children: {}, count: 0 };

        // First build structure from all known folders
        folders.forEach(folderPath => {
            // Normalize path to use forward slashes (in case of mixed separators)
            const normalizedPath = folderPath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/');
            if (!normalizedPath || normalizedPath === '.') return;

            let current = root;
            let currentPath = '';

            parts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!current.children[part]) {
                    current.children[part] = { name: part, path: currentPath, children: {}, count: 0 };
                }
                current = current.children[part];
            });
        });

        // Then populate counts from filtered assets
        assets.forEach(asset => {
            // Normalize path to use forward slashes (in case of mixed separators)
            const normalizedPath = asset.path.replace(/\\/g, '/');
            const parts = normalizedPath.split('/');
            parts.pop(); // Remove filename

            let current = root;
            root.count++;

            parts.forEach(part => {
                if (current.children[part]) {
                    current = current.children[part];
                    current.count++;
                }
            });
        });

        return root;
    }, [folders, assets]);

    return folderTree;
};
