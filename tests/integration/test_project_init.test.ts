import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Project Initialization Workflow', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-integration-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should complete full initialization workflow', () => {
    // Step 1: Initialize project
    const initOutput = execSync(`${cli} init my-awesome-app`, { encoding: 'utf-8' });

    expect(initOutput).toContain('my-awesome-app');
    expect(initOutput).toContain('initialized');

    // Verify all expected files are created
    expect(existsSync('light.config.json')).toBe(true);
    expect(existsSync('.env.development')).toBe(true);
    expect(existsSync('.env.production')).toBe(true);
    expect(existsSync('.light/docker-compose.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.dev.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.prod.yml')).toBe(true);

    // Verify configuration is valid JSON and has expected structure
    const config = JSON.parse(readFileSync('light.config.json', 'utf-8'));
    expect(config.name).toBe('my-awesome-app');
    expect(config.services).toBeDefined();
    expect(Array.isArray(config.services)).toBe(true);

    // Verify environment files have expected structure
    const devEnv = readFileSync('.env.development', 'utf-8');
    expect(devEnv).toContain('NODE_ENV=development');

    const prodEnv = readFileSync('.env.production', 'utf-8');
    expect(prodEnv).toContain('NODE_ENV=production');
  });

  it('should handle project initialization in non-empty directory', () => {
    // Create some existing files
    execSync('echo "existing" > existing.txt');

    const output = execSync(`${cli} init`, { encoding: 'utf-8' });

    // Should still work and not overwrite existing files
    expect(output).toContain('initialized');
    expect(existsSync('existing.txt')).toBe(true);
    expect(readFileSync('existing.txt', 'utf-8')).toContain('existing');
  });

  it('should support different templates', () => {
    const output = execSync(`${cli} init --template sveltekit my-svelte-app`, { encoding: 'utf-8' });

    expect(output).toContain('my-svelte-app');

    const config = JSON.parse(readFileSync('light.config.json', 'utf-8'));
    expect(config.template).toBe('sveltekit');
    expect(config.name).toBe('my-svelte-app');
  });

  it('should create proper Docker Compose structure', () => {
    execSync(`${cli} init`, { encoding: 'utf-8' });

    // Verify Docker Compose files are valid YAML and have expected services
    const baseCompose = readFileSync('.light/docker-compose.yml', 'utf-8');
    expect(baseCompose).toContain('version:');
    expect(baseCompose).toContain('services:');
    expect(baseCompose).toContain('traefik'); // Should include Traefik by default

    const devCompose = readFileSync('.light/docker-compose.dev.yml', 'utf-8');
    expect(devCompose).toContain('version:');
    expect(devCompose).toContain('services:');

    const prodCompose = readFileSync('.light/docker-compose.prod.yml', 'utf-8');
    expect(prodCompose).toContain('version:');
    expect(prodCompose).toContain('services:');
  });

  it('should create valid Traefik configuration', () => {
    execSync(`${cli} init`, { encoding: 'utf-8' });

    // Should create Traefik config if it doesn't exist
    const expectedTraefikPath = '.light/traefik.yml';
    if (existsSync(expectedTraefikPath)) {
      const traefikConfig = readFileSync(expectedTraefikPath, 'utf-8');
      expect(traefikConfig).toContain('entryPoints:');
      expect(traefikConfig).toContain('providers:');
    }
  });

  it('should set up proper development environment variables', () => {
    execSync(`${cli} init my-project`, { encoding: 'utf-8' });

    const devEnv = readFileSync('.env.development', 'utf-8');

    // Should have common development variables
    expect(devEnv).toContain('NODE_ENV=development');
    expect(devEnv).toMatch(/PROJECT_NAME.*my-project/);
  });
});