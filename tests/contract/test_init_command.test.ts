import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
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

  it('should generate docker-compose.deployment.yml with app service', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Verify deployment.yml exists (not production.yml)
    expect(existsSync('.light/docker-compose.deployment.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.production.yml')).toBe(false);

    // Verify deployment.yml contains app service
    const deploymentContent = readFileSync('.light/docker-compose.deployment.yml', 'utf-8');
    expect(deploymentContent).toContain('app:');
    expect(deploymentContent).toContain('build:');
    expect(deploymentContent).toContain('dockerfile: Dockerfile');
    expect(deploymentContent).toContain('traefik.enable=true');
    expect(deploymentContent).toContain('traefik.http.routers.app.rule');
  });

  it('should generate Dockerfile in project root when scripts exist', () => {
    // Create a minimal package.json first (required for Dockerfile generation)
    writeFileSync('package.json', JSON.stringify({
      name: 'test',
      scripts: {
        build: 'echo build',
        start: 'echo start'
      }
    }));

    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Verify Dockerfile exists in project root (not in .light/)
    expect(existsSync('Dockerfile')).toBe(true);
    expect(existsSync('.light/Dockerfile')).toBe(false);

    // Verify Dockerfile contains multi-stage build pattern
    const dockerfileContent = readFileSync('Dockerfile', 'utf-8');
    expect(dockerfileContent).toContain('FROM node:');
    expect(dockerfileContent).toContain('AS deps');
    expect(dockerfileContent).toContain('AS builder');
    expect(dockerfileContent).toContain('AS runner');
  });

  it('should silently skip Dockerfile generation when package.json missing required scripts', () => {
    // FR-012 Clarification (2025-10-12): Don't block init for missing scripts
    // Validation happens at deployment time, not init time
    writeFileSync('package.json', JSON.stringify({
      name: 'test',
      scripts: {
        dev: 'vite' // Missing build and start scripts
      }
    }));

    const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Should still initialize successfully
    expect(output).toContain('initialized');
    expect(output).not.toContain('Skipping Dockerfile'); // No user-visible error
    expect(output).not.toContain('missing required scripts'); // No user-visible error

    // Dockerfile should NOT be generated
    expect(existsSync('Dockerfile')).toBe(false);

    // But infrastructure files should still be created
    expect(existsSync('.light/docker-compose.yml')).toBe(true);
  });
});