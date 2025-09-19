import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('light init command', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    // Clean up
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize a new project with default name', () => {
    const output = execSync(`${cli} init`, { encoding: 'utf-8' });

    expect(output).toContain('Project');
    expect(output).toContain('initialized');
    expect(existsSync('light.config.json')).toBe(true);
    expect(existsSync('.env.development')).toBe(true);
    expect(existsSync('.env.production')).toBe(true);
    expect(existsSync('.light/docker-compose.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.dev.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.prod.yml')).toBe(true);
  });

  it('should initialize a project with custom name', () => {
    const output = execSync(`${cli} init my-app`, { encoding: 'utf-8' });

    expect(output).toContain('my-app');
    const config = JSON.parse(readFileSync('light.config.json', 'utf-8'));
    expect(config.name).toBe('my-app');
  });

  it('should support --template option', () => {
    const output = execSync(`${cli} init --template sveltekit`, { encoding: 'utf-8' });

    const config = JSON.parse(readFileSync('light.config.json', 'utf-8'));
    expect(config.template).toBe('sveltekit');
  });

  it('should reject invalid project names', () => {
    expect(() => {
      execSync(`${cli} init "Invalid Name!"`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should prevent overwriting existing project without --force', () => {
    execSync(`${cli} init`, { encoding: 'utf-8' });

    expect(() => {
      execSync(`${cli} init`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should allow overwriting with --force flag', () => {
    execSync(`${cli} init`, { encoding: 'utf-8' });

    const output = execSync(`${cli} init --force`, { encoding: 'utf-8' });
    expect(output).toContain('initialized');
  });

  it('should create local SSL certificates with mkcert', () => {
    const output = execSync(`${cli} init`, { encoding: 'utf-8' });

    expect(output).toContain('certificates');
    expect(existsSync('.light/certs')).toBe(true);
  });
});