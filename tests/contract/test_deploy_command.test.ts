import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('light deploy command', () => {
  let tempDir: string;
  const cli = `node ${join(__dirname, '..', '..', 'dist', 'cli.js')}`;

  let originalDir: string;

  beforeEach(() => {
    originalDir = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    // Create a project with deployment configuration
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [{
        name: 'production',
        host: 'example.com',
        domain: 'myapp.com',
        ssl: {
          enabled: true,
          provider: 'letsencrypt',
          email: 'test@example.com'
        }
      }]
    }));
    // Also create .light directory structure expected by deploy command
    mkdirSync('.light');
    writeFileSync('.light/docker-compose.yml', `services:
  traefik:
    image: traefik:v3.0
  app:
    image: nginx:alpine
`);
    writeFileSync('.light/docker-compose.production.yml', `services:
  traefik:
    environment:
      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=test@example.com
`);
  });

  afterEach(() => {
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should deploy to default environment (production)', () => {
    const output = execSync(`${cli} deploy --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('production');
    expect(output).toContain('DRY RUN MODE');
  });

  it('should deploy to specified environment', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [
        {
          name: 'staging',
          host: 'staging.example.com',
          domain: 'staging.myapp.com'
        }
      ]
    }));
    mkdirSync('.light', { recursive: true });
    writeFileSync('.light/docker-compose.yml', 'services:\n  traefik:\n    image: traefik:v3.0');
    writeFileSync('.light/docker-compose.staging.yml', 'services:\n  traefik:\n    environment:\n      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=staging@example.com');

    const output = execSync(`${cli} deploy staging --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('staging');
    expect(output).toContain('staging.example.com');
  });

  it('should support --dry-run flag', () => {
    const output = execSync(`${cli} deploy --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('DRY RUN MODE');
  });

  it('should support --build flag', () => {
    const output = execSync(`${cli} deploy --build --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('DRY RUN MODE');
  });

  it('should support --rollback flag', () => {
    const output = execSync(`${cli} deploy --rollback --dry-run`, { encoding: 'utf-8' });

    expect(output.toLowerCase()).toContain('rollback');
  });

  it('should validate environment exists', () => {
    expect(() => {
      execSync(`${cli} deploy nonexistent`, { encoding: 'utf-8' });
    }).toThrow(/Environment.*not found/i);
  });

  it('should validate deployment prerequisites', () => {
    const output = execSync(`${cli} deploy --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('Validating configuration');
    expect(output).toContain('Checking deployment target');
  });

  it('should validate deployment configuration', () => {
    // Test with missing required deployment fields
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [{
        name: 'production'
        // Missing required host field
      }]
    }));
    mkdirSync('.light', { recursive: true });
    writeFileSync('.light/docker-compose.yml', 'services:\n  traefik:\n    image: traefik:v3.0');
    writeFileSync('.light/docker-compose.production.yml', 'services:\n  traefik:\n    environment:\n      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=test@example.com');

    expect(() => {
      execSync(`${cli} deploy --dry-run`, { encoding: 'utf-8' });
    }).toThrow();
  });
});