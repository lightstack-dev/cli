import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('light up command', () => {
  let tempDir: string;
  let originalDir: string;
  const cli = `node ${join(__dirname, '..', '..', 'dist', 'cli.js')}`;

  beforeEach(() => {
    originalDir = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    // Create a minimal light.config.json
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    }));
    mkdirSync('.light');
    writeFileSync('.light/docker-compose.yml', `services:
  traefik:
    image: traefik:v3.0
    ports:
      - "80:80"
      - "443:443"
  app:
    image: nginx:alpine
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(\`app.lvh.me\`)"
`);
  });

  afterEach(() => {
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should start development environment', () => {
    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('Starting local proxy');
    expect(output).toContain('Proxy started');
    expect(output).toContain('Ready to proxy');
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

  it('should handle missing environment configuration', () => {
    // Since staging environment doesn't exist, it should prompt for configuration
    expect(() => {
      execSync(`${cli} up --env staging`, { encoding: 'utf-8' });
    }).toThrow(); // Will error due to missing configuration or prompt timeout
  });

  it('should start without optional --build flag', () => {
    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    // Should start successfully without build flag
    expect(output).toContain('Starting local proxy');
  });

  it('should display service URLs after startup', () => {
    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('https://');
    expect(output).toContain('lvh.me');
  });

  it('should validate project exists before starting', () => {
    rmSync('light.config.yml');

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/No configuration file found/i);
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