import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('Project initialization and HTTPS configuration', () => {
  let tempDir: string;
  let originalDir: string;
  const cli = `node ${join(__dirname, '..', '..', 'dist', 'cli.js')}`;

  beforeEach(() => {
    originalDir = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize project with proxy configuration', () => {
    const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    expect(output).toContain('Project \'test-project\' initialized');
    expect(output).toContain('Proxy configuration created');
    expect(existsSync('.light')).toBe(true);
  });

  it('should create docker-compose configuration', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Should create docker-compose file
    expect(existsSync('.light/docker-compose.yml')).toBe(true);
  });

  it('should configure Traefik for HTTPS in docker-compose', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Check that generated docker-compose includes HTTPS configuration
    const dockerComposeContent = require('fs').readFileSync('.light/docker-compose.yml', 'utf-8');
    expect(dockerComposeContent).toContain('traefik');
    expect(dockerComposeContent).toContain('websecure');
  });

  it('should support SSL in production environment configuration via CLI flags', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Configure production environment with all required flags to avoid prompts
    const output = execSync(`${cli} env add production --host prod.example.com --domain example.com --ssl-email admin@example.com --user deploy --port 22`, { encoding: 'utf-8' });

    expect(output).toContain('Added \'production\' environment');

    // Check configuration includes SSL settings
    const config = yaml.load(require('fs').readFileSync('light.config.yml', 'utf-8')) as any;
    const prodEnv = config.deployments?.find((d: any) => d.name === 'production');
    expect(prodEnv?.ssl?.enabled).toBe(true);
    expect(prodEnv?.ssl?.email).toBe('admin@example.com');
  });
});