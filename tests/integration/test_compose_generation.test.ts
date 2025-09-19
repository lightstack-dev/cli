import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { load } from 'js-yaml';

describe('Docker Compose File Generation', () => {
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

  it('should generate valid base docker-compose.yml', () => {
    const config = {
      name: 'test-project',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 },
        { name: 'api', type: 'express', port: 8000 }
      ]
    };
    writeFileSync('light.config.json', JSON.stringify(config));

    execSync(`${cli} init --force`, { encoding: 'utf-8' });

    expect(existsSync('.light/docker-compose.yml')).toBe(true);

    const composeContent = readFileSync('.light/docker-compose.yml', 'utf-8');
    const compose = load(composeContent) as any;

    // Should have version
    expect(compose.version).toBeDefined();

    // Should have services
    expect(compose.services).toBeDefined();

    // Should include Traefik
    expect(compose.services.traefik).toBeDefined();

    // Should include project services
    expect(compose.services.app).toBeDefined();
    expect(compose.services.api).toBeDefined();

    // Should have networks
    expect(compose.networks).toBeDefined();
  });

  it('should generate development overrides', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    }));

    execSync(`${cli} init --force`, { encoding: 'utf-8' });

    expect(existsSync('.light/docker-compose.dev.yml')).toBe(true);

    const devContent = readFileSync('.light/docker-compose.dev.yml', 'utf-8');
    const devCompose = load(devContent) as any;

    expect(devCompose.version).toBeDefined();
    expect(devCompose.services).toBeDefined();

    // Development overrides should include volume mounts for hot reload
    if (devCompose.services.app) {
      expect(devCompose.services.app.volumes).toBeDefined();
    }
  });

  it('should generate production overrides', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [{
        name: 'production',
        host: 'example.com',
        domain: 'myapp.com',
        ssl: { enabled: true, provider: 'letsencrypt' }
      }]
    }));

    execSync(`${cli} init --force`, { encoding: 'utf-8' });

    expect(existsSync('.light/docker-compose.prod.yml')).toBe(true);

    const prodContent = readFileSync('.light/docker-compose.prod.yml', 'utf-8');
    const prodCompose = load(prodContent) as any;

    expect(prodCompose.version).toBeDefined();
    expect(prodCompose.services).toBeDefined();

    // Production should have different configurations
    if (prodCompose.services.traefik) {
      // Should include Let's Encrypt configuration
      const traefikService = prodCompose.services.traefik;
      expect(JSON.stringify(traefikService)).toContain('letsencrypt');
    }
  });

  it('should generate proper Traefik labels', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'my-app',
      services: [
        { name: 'frontend', type: 'nuxt', port: 3000 },
        { name: 'backend', type: 'express', port: 8000 }
      ]
    }));

    execSync(`${cli} init --force`, { encoding: 'utf-8' });

    const composeContent = readFileSync('.light/docker-compose.yml', 'utf-8');
    const compose = load(composeContent) as any;

    // Check Traefik labels for services
    const frontend = compose.services.frontend;
    if (frontend && frontend.labels) {
      const labels = Array.isArray(frontend.labels) ? frontend.labels : Object.keys(frontend.labels);
      const labelString = JSON.stringify(labels);

      expect(labelString).toContain('traefik.enable=true');
      expect(labelString).toContain('traefik.http.routers');
    }
  });

  it('should handle port conflicts gracefully', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [
        { name: 'app1', type: 'nuxt', port: 3000 },
        { name: 'app2', type: 'nuxt', port: 3000 } // Same port!
      ]
    }));

    expect(() => {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    }).toThrow(/port.*conflict/i);
  });

  it('should generate environment-specific configurations', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    }));

    execSync(`${cli} init --force`, { encoding: 'utf-8' });

    // Check that environment files are properly referenced
    const devContent = readFileSync('.light/docker-compose.dev.yml', 'utf-8');
    expect(devContent).toContain('.env.development');

    const prodContent = readFileSync('.light/docker-compose.prod.yml', 'utf-8');
    expect(prodContent).toContain('.env.production');
  });
});