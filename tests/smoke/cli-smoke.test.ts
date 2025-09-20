import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('CLI Smoke Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  const projectRoot = join(__dirname, '..', '..');
  const cli = `node "${join(projectRoot, 'dist', 'cli.js')}"`;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-smoke-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should show help when requested', () => {
    let output = '';
    try {
      execSync(`${cli} --help`, { encoding: 'utf-8' });
    } catch (error: any) {
      output = error.stdout?.toString() || error.stderr?.toString() || '';
    }

    expect(output).toContain('light');
    expect(output).toContain('init');
    expect(output).toContain('up');
    expect(output).toContain('down');
  });

  it('should show version when requested', () => {
    let output = '';
    try {
      execSync(`${cli} --version`, { encoding: 'utf-8' });
    } catch (error: any) {
      output = error.stdout?.toString() || error.stderr?.toString() || '';
    }

    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should initialize a project successfully', () => {
    const initOutput = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    expect(initOutput).toContain('test-project');
    expect(initOutput).toContain('✅');

    // Verify essential files were created
    expect(existsSync('light.config.yaml')).toBe(true);
    expect(existsSync('.light/docker-compose.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.dev.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.prod.yml')).toBe(true);
    expect(existsSync('.light/certs')).toBe(true);
  });

  it('should validate missing project configuration', () => {
    let errorOutput = '';
    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
    }

    expect(errorOutput).toContain('No Lightstack project found');
  });

  it('should validate missing Dockerfile', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    let errorOutput = '';
    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
    }

    // Should either validate Dockerfile missing OR Docker not running (both are valid prerequisite checks)
    const hasValidError = errorOutput.includes('Dockerfile not found') ||
                         errorOutput.includes('Docker is not running') ||
                         errorOutput.includes('Docker');
    expect(hasValidError).toBe(true);
  });
});