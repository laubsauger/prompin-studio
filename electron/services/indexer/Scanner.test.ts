// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scanner } from './Scanner.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Scanner', () => {
    let scanner: Scanner;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-studio-scanner-test-'));
        scanner = new Scanner((filePath: string) => {
            const ext = path.extname(filePath).toLowerCase();
            return ['.jpg', '.png', '.txt'].includes(ext); // Allow .txt for testing
        });
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should scan directories recursively', async () => {
        await fs.mkdir(path.join(tempDir, 'subdir'));
        await fs.writeFile(path.join(tempDir, 'file1.jpg'), 'content');
        await fs.writeFile(path.join(tempDir, 'subdir', 'file2.png'), 'content');

        const files: string[] = [];
        await scanner.scanDirectory(tempDir, async (file: string) => {
            files.push(file);
        });

        expect(files).toHaveLength(2);
        expect(files).toContain(path.join(tempDir, 'file1.jpg'));
        expect(files).toContain(path.join(tempDir, 'subdir', 'file2.png'));
    });

    it('should handle symlinks by reporting them as files within the root', async () => {
        // Create a file OUTSIDE the root
        const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-studio-outside-'));
        const outsideFile = path.join(outsideDir, 'outside.jpg');
        await fs.writeFile(outsideFile, 'outside content');

        // Create a symlink INSIDE the root pointing to the outside file
        const symlinkPath = path.join(tempDir, 'link.jpg');
        await fs.symlink(outsideFile, symlinkPath);

        const files: string[] = [];
        await scanner.scanDirectory(tempDir, async (file: string) => {
            files.push(file);
        });

        // Cleanup outside dir
        await fs.rm(outsideDir, { recursive: true, force: true });

        expect(files).toHaveLength(1);
        // CRITICAL: The scanner should report the path of the SYMLINK (inside tempDir),
        // NOT the path of the target (outsideDir).
        expect(files[0]).toBe(symlinkPath);
        expect(files[0].startsWith(tempDir)).toBe(true);
    });

    it('should skip hidden files and folders', async () => {
        await fs.writeFile(path.join(tempDir, '.hidden.jpg'), 'content');
        await fs.mkdir(path.join(tempDir, '.hiddenDir'));
        await fs.writeFile(path.join(tempDir, '.hiddenDir', 'file.jpg'), 'content');

        const files: string[] = [];
        await scanner.scanDirectory(tempDir, async (file: string) => {
            files.push(file);
        });

        expect(files).toHaveLength(0);
    });
});
