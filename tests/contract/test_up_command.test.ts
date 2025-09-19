import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('light up command', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    // Create a minimal light.config.json
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    }));
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should start development environment', () => {
    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('Starting services');
    expect(output).toContain('Docker daemon running');
    expect(output).toContain('All services running');
  });

  it('should validate Docker is running', () => {
    // This test assumes Docker might not be running
    // In a real test environment, we'd mock this
    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toContain('Docker');
        expect(error.message).toContain('not running');
      }
    }
  });

  it('should support --env option', () => {
    const output = execSync(`${cli} up --env staging`, { encoding: 'utf-8' });

    expect(output).toContain('staging');
  });

  it('should support --build flag to force rebuild', () => {
    const output = execSync(`${cli} up --build`, { encoding: 'utf-8' });

    expect(output).toContain('rebuild');
  });

  it('should detect port conflicts', () => {
    // Simulate port conflict
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [
        { name: 'app1', type: 'nuxt', port: 80 },
        { name: 'app2', type: 'nuxt', port: 80 }
      ]
    }));

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/port.*conflict/i);
  });

  it('should display service URLs after startup', () => {
    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('https://');
    expect(output).toContain('lvh.me');
  });

  it('should validate project exists before starting', () => {
    rmSync('light.config.json');

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/no.*project/i);
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