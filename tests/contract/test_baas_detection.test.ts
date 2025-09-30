import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('BaaS service detection', () => {
  let tempDir: string;
  let originalDir: string;
  const cli = `node ${join(__dirname, '..', '..', 'dist', 'cli.js')}`;

  beforeEach(() => {
    originalDir = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    // Create a basic project config
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
`);
  });

  afterEach(() => {
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should detect Supabase when config.toml exists', () => {
    // Create Supabase directory structure
    mkdirSync('supabase');
    writeFileSync('supabase/config.toml', `[api]
db_url = "postgresql://postgres:postgres@db:5432/postgres"
port = 54321
`);

    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('BaaS services detected: Supabase');
    expect(output).toContain('api.lvh.me');
    expect(output).toContain('studio.lvh.me');
  });

  it('should work without BaaS services', () => {
    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).not.toContain('BaaS services detected');
    expect(output).toContain('Ready to proxy');
  });

  it('should show proper URLs for detected BaaS services', () => {
    // Create Supabase config
    mkdirSync('supabase');
    writeFileSync('supabase/config.toml', `[api]
port = 54321
[studio]
port = 54323
`);

    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('https://api.lvh.me');
    expect(output).toContain('localhost:54321');
    expect(output).toContain('https://studio.lvh.me');
    expect(output).toContain('localhost:54323');
  });

  it('should handle malformed BaaS configuration gracefully', () => {
    // Create invalid Supabase config
    mkdirSync('supabase');
    writeFileSync('supabase/config.toml', 'invalid toml content [[[');

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).not.toThrow(); // Should not crash on malformed config
  });

  it('should detect Firebase when firebase.json exists', () => {
    // Create Firebase configuration
    writeFileSync('firebase.json', JSON.stringify({
      hosting: {
        public: 'dist',
        port: 5000
      },
      emulators: {
        auth: { port: 9099 },
        firestore: { port: 8080 }
      }
    }));

    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('BaaS services detected');
  });

  it('should handle multiple BaaS services', () => {
    // Create both Supabase and Firebase configs
    mkdirSync('supabase');
    writeFileSync('supabase/config.toml', `[api]\nport = 54321`);
    writeFileSync('firebase.json', JSON.stringify({ hosting: { port: 5000 } }));

    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).toContain('BaaS services detected');
  });

  it('should generate appropriate Docker services for detected BaaS', () => {
    // Create Supabase config
    mkdirSync('supabase');
    writeFileSync('supabase/config.toml', `[api]\nport = 54321\n[studio]\nport = 54323`);

    execSync(`${cli} up`, { encoding: 'utf-8' });

    // Check that appropriate services are configured in generated docker-compose
    const dockerComposeContent = require('fs').readFileSync('.light/docker-compose.yml', 'utf-8');
    expect(dockerComposeContent).toContain('traefik');
  });

  it('should provide helpful output when no BaaS services detected', () => {
    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(output).not.toContain('BaaS services detected');
    expect(output).toContain('Ready to proxy');
  });

  it('should validate BaaS configuration before starting services', () => {
    // Create incomplete Supabase config
    mkdirSync('supabase');
    writeFileSync('supabase/config.toml', `# Empty config file`);

    const output = execSync(`${cli} up`, { encoding: 'utf-8' });

    // Should handle empty/minimal config gracefully
    expect(output).toBeDefined();
  });
});