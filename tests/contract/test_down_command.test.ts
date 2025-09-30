import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('light down command', () => {
  let tempDir: string;
  let originalDir: string;
  const cli = `node ${join(__dirname, '..', '..', 'dist', 'cli.js')}`;

  beforeEach(() => {
    originalDir = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 },
        { name: 'database', type: 'supabase', port: 5432 }
      ]
    }));
  });

  afterEach(() => {
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should stop development environment', () => {
    const output = execSync(`${cli} down`, { encoding: 'utf-8' });

    expect(output).toContain('Stopping');
    expect(output).toContain('stopped');
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
    rmSync('light.config.yml');

    expect(() => {
      execSync(`${cli} down`, { encoding: 'utf-8' });
    }).toThrow(/No Lightstack project found/i);
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

  it('should handle repeated down commands gracefully', () => {
    // Run down command multiple times - should not error
    execSync(`${cli} down`, { encoding: 'utf-8' });
    const output = execSync(`${cli} down`, { encoding: 'utf-8' });

    expect(output).toBeDefined();
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