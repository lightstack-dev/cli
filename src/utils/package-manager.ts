import { existsSync, statSync, readFileSync } from 'fs';
import { join, dirname, parse } from 'path';
import { execSync } from 'child_process';

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

/**
 * Detect if the project is in a workspace (monorepo) structure
 * Returns workspace info or null if standalone project
 */
export function detectWorkspace(): { isWorkspace: true; lockFile: string; subdirName: string } | { isWorkspace: false } {
  const currentDir = process.cwd();
  const parentDir = dirname(currentDir);

  // Check if lock file exists in current directory (standalone project)
  for (const lockFile of LOCK_FILES) {
    if (existsSync(join(currentDir, lockFile.name))) {
      return { isWorkspace: false };
    }
  }

  // Check if lock file exists in parent directory (workspace project)
  for (const lockFile of LOCK_FILES) {
    const parentLockPath = join(parentDir, lockFile.name);
    if (existsSync(parentLockPath)) {
      return {
        isWorkspace: true,
        lockFile: lockFile.name,
        subdirName: parse(currentDir).base
      };
    }
  }

  // No lock file found in current or parent - treat as standalone
  return { isWorkspace: false };
}

/**
 * Check if Supabase CLI is available and return the command to run it
 * Returns null if Supabase CLI is not available
 *
 * Strategy:
 * 1. Check if 'supabase' is in package.json devDependencies
 * 2. If yes, use package manager's run command (bun x, npx, etc.)
 * 3. If no, try global 'supabase' command
 * 4. Return null if neither works
 */
export function getSupabaseCli(): string | null {
  // Check if supabase is in devDependencies
  if (existsSync('package.json')) {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      const hasSupabase = packageJson.devDependencies?.supabase || packageJson.dependencies?.supabase;

      if (hasSupabase) {
        // Supabase is installed as dependency, use package manager
        const manager = detectPackageManager();

        switch (manager) {
          case 'bun':
            return 'bun x supabase';
          case 'pnpm':
            return 'pnpm dlx supabase';
          case 'yarn':
            return 'yarn supabase';
          case 'npm':
            return 'npx supabase';
        }
      }
    } catch {
      // Failed to parse package.json, continue to global check
    }
  }

  // Try global supabase command
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    return 'supabase';
  } catch {
    // Not available globally
  }

  return null;
}
