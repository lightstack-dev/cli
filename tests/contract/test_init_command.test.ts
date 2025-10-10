import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('light init command', () => {
  let tempDir: string;
  let originalDir: string;
  const cli = `node ${join(__dirname, '..', '..', 'dist', 'cli.js')}`;

  beforeEach(() => {
    originalDir = process.cwd();
    // Create a temporary directory for each test
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    // Clean up
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize a new project with explicit name', () => {
    const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    expect(output).toContain('test-project');
    expect(output).toContain('initialized');
    expect(existsSync('light.config.yml') || existsSync('light.config.yml')).toBe(true);
    // Environment files and compose overrides are created on demand
    expect(existsSync('.light/docker-compose.yml')).toBe(true);
  });

  it('should initialize a project with custom name', () => {
    const output = execSync(`${cli} init my-app`, { encoding: 'utf-8' });

    expect(output).toContain('my-app');
    const configContent = readFileSync('light.config.yml', 'utf-8');
    const config = yaml.load(configContent) as any;
    expect(config.name).toBe('my-app');
  });

  it('should reject invalid project names', () => {
    expect(() => {
      execSync(`${cli} init "Invalid Name!"`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should prevent overwriting existing project without --force', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    expect(() => {
      execSync(`${cli} init test-project`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should allow overwriting with --force flag', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    const output = execSync(`${cli} init test-project --force`, { encoding: 'utf-8' });
    expect(output).toContain('initialized');
  });

  it('should create local SSL certificate directories', () => {
    const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    expect(output).toContain('initialized');
    expect(existsSync('.light/certs')).toBe(true);
  });
});