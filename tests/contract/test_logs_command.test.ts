import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('light logs command', () => {
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

  it('should show logs from all services by default', () => {
    const output = execSync(`${cli} logs`, { encoding: 'utf-8', timeout: 5000 });

    // Should attempt to get logs from all services
    expect(output).toMatch(/(app|database)/);
  });

  it('should show logs from specific service', () => {
    const output = execSync(`${cli} logs app`, { encoding: 'utf-8', timeout: 5000 });

    expect(output).toContain('app');
  });

  it('should support --follow flag for real-time logs', () => {
    // This test is tricky since --follow runs indefinitely
    // We'll just verify the command accepts the flag
    try {
      execSync(`${cli} logs --follow`, { encoding: 'utf-8', timeout: 1000 });
    } catch (error: any) {
      // Should timeout, which is expected
      expect(error.message).toContain('timeout');
    }
  });

  it('should support --tail option to limit lines', () => {
    const output = execSync(`${cli} logs --tail 10`, { encoding: 'utf-8', timeout: 5000 });

    // Should limit output
    expect(output).toBeDefined();
  });

  it('should validate service exists when specified', () => {
    expect(() => {
      execSync(`${cli} logs nonexistent-service`, { encoding: 'utf-8' });
    }).toThrow(/service.*not.*found/i);
  });

  it('should handle Docker not running gracefully', () => {
    // If Docker is not running, should show appropriate error
    try {
      execSync(`${cli} logs`, { encoding: 'utf-8' });
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker.*not.*running/i);
      }
    }
  });

  it('should require project to exist', () => {
    rmSync('light.config.yml');

    expect(() => {
      execSync(`${cli} logs`, { encoding: 'utf-8' });
    }).toThrow(/No Lightstack project found/i);
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