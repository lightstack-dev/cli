import { cpSync, existsSync } from 'fs';

/**
 * Copy a directory recursively
 */
export function copyDirectory(src: string, dest: string): void {
  if (!existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }

  cpSync(src, dest, { recursive: true });
}
