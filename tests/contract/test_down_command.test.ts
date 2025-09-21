import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('light down command', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 },
        { name: 'database', type: 'supabase', port: 5432 }
      ]
    }));
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should stop development environment', () => {
    const output = execSync(`${cli} down`, { encoding: 'utf-8' });

    expect(output).toContain('Stopping services');
    expect(output).toContain('Development environment stopped');
  });

  it('should support --volumes flag with warning', () => {
    const output = execSync(`${cli} down --volumes`, { encoding: 'utf-8' });

    expect(output).toMatch(/(warning|data loss)/i);
    expect(output).toContain('volumes');
  });

  it('should handle case where no services are running', () => {
    const output = execSync(`${cli} down`, { encoding: 'utf-8' });

    // Should not error even if nothing is running
    expect(output).toBeDefined();
  });

  it('should require project to exist', () => {
    rmSync('light.config.json');

    expect(() => {
      execSync(`${cli} down`, { encoding: 'utf-8' });
    }).toThrow(/no.*project/i);
  });

  it('should handle Docker not running gracefully', () => {
    try {
      execSync(`${cli} down`, { encoding: 'utf-8' });
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker.*not.*running/i);
      }
    }
  });

  it('should complete quickly', () => {
    const start = Date.now();
    execSync(`${cli} down`, { encoding: 'utf-8' });
    const duration = Date.now() - start;

    // Should complete within reasonable time
    expect(duration).toBeLessThan(10000); // 10 seconds
  });
});

function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}