import { existsSync, statSync } from 'fs';
import { join, dirname, parse } from 'path';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

interface LockFile {
  name: string;
  manager: PackageManager;
}

const LOCK_FILES: LockFile[] = [
  { name: 'package-lock.json', manager: 'npm' },
  { name: 'yarn.lock', manager: 'yarn' },
  { name: 'pnpm-lock.yaml', manager: 'pnpm' },
  { name: 'bun.lockb', manager: 'bun' },  // Binary format (older)
  { name: 'bun.lock', manager: 'bun' },   // Text format (newer, default since v1.2)
];

/**
 * Detect package manager based on lock files, walking up directory tree
 * Handles workspace children by checking parent directories
 */
export function detectPackageManager(): PackageManager {
  let currentDir = process.cwd();

  // Walk up the directory tree until we find lock files or hit the root
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const foundLockFiles: Array<{ manager: PackageManager; mtime: Date }> = [];

    for (const lockFile of LOCK_FILES) {
      const filepath = join(currentDir, lockFile.name);
      if (existsSync(filepath)) {
        const stats = statSync(filepath);
        foundLockFiles.push({
          manager: lockFile.manager,
          mtime: stats.mtime,
        });
      }
    }

    // If we found lock files, use them
    if (foundLockFiles.length > 0) {
      // If multiple lock files exist, use the most recently modified one
      if (foundLockFiles.length > 1) {
        foundLockFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      }
      return foundLockFiles[0]!.manager;
    }

    // Move up one directory
    const parentDir = dirname(currentDir);

    // Check if we've reached the filesystem root
    if (parentDir === currentDir || parse(currentDir).root === currentDir) {
      // No lock files found anywhere, default to npm
      return 'npm';
    }

    currentDir = parentDir;
  }
}

/**
 * Get the dev command for the detected package manager
 */
export function getDevCommand(): string {
  const manager = detectPackageManager();

  switch (manager) {
    case 'npm':
      return 'npm run dev';
    case 'yarn':
      return 'yarn dev';
    case 'pnpm':
      return 'pnpm dev';
    case 'bun':
      return 'bun dev';
  }
}
