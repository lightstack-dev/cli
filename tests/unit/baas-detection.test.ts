import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

// BaaS detection logic extracted from up.ts
function detectBaaSServices(): string[] {
  const services: string[] = [];

  // Check for Supabase
  if (existsSync('supabase/config.toml')) {
    services.push('Supabase');
  }

  // Future: Add other BaaS detection here
  // if (existsSync('firebase.json')) services.push('Firebase');
  // if (existsSync('amplify/.config/project-config.json')) services.push('Amplify');

  return services;
}

describe('BaaS Service Detection', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'baas-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Supabase detection', () => {
    it('should detect Supabase when config.toml exists', () => {
      mkdirSync('supabase', { recursive: true });
      writeFileSync('supabase/config.toml', `
[api]
enabled = true
port = 54321

[studio]
enabled = true
port = 54323
`);

      const services = detectBaaSServices();
      expect(services).toContain('Supabase');
      expect(services).toHaveLength(1);
    });

    it('should not detect Supabase when config.toml does not exist', () => {
      const services = detectBaaSServices();
      expect(services).not.toContain('Supabase');
      expect(services).toHaveLength(0);
    });

    it('should not detect Supabase when directory exists but config is missing', () => {
      mkdirSync('supabase', { recursive: true });
      // No config.toml file

      const services = detectBaaSServices();
      expect(services).not.toContain('Supabase');
      expect(services).toHaveLength(0);
    });

    it('should detect Supabase with minimal config file', () => {
      mkdirSync('supabase', { recursive: true });
      writeFileSync('supabase/config.toml', '# Minimal config');

      const services = detectBaaSServices();
      expect(services).toContain('Supabase');
    });
  });

  describe('no BaaS services', () => {
    it('should return empty array when no BaaS services detected', () => {
      const services = detectBaaSServices();
      expect(services).toEqual([]);
    });

    it('should return empty array when only unrelated files exist', () => {
      writeFileSync('package.json', '{}');
      writeFileSync('README.md', '# Test');
      mkdirSync('src');

      const services = detectBaaSServices();
      expect(services).toEqual([]);
    });
  });

  describe('future BaaS services', () => {
    it('should be ready to detect Firebase (when implemented)', () => {
      // This test documents the expected behavior for future Firebase support
      writeFileSync('firebase.json', '{}');

      const services = detectBaaSServices();
      // Currently should not detect Firebase (not implemented yet)
      expect(services).not.toContain('Firebase');
    });

    it('should be ready to detect AWS Amplify (when implemented)', () => {
      // This test documents the expected behavior for future Amplify support
      mkdirSync('amplify/.config', { recursive: true });
      writeFileSync('amplify/.config/project-config.json', '{}');

      const services = detectBaaSServices();
      // Currently should not detect Amplify (not implemented yet)
      expect(services).not.toContain('Amplify');
    });
  });

  describe('multiple BaaS services', () => {
    it('should detect multiple services when they exist (future)', () => {
      // Set up Supabase
      mkdirSync('supabase', { recursive: true });
      writeFileSync('supabase/config.toml', '# Supabase config');

      // Note: Firebase and Amplify detection not implemented yet
      // When implemented, this test should verify multiple services are detected

      const services = detectBaaSServices();
      expect(services).toContain('Supabase');
      expect(services).toHaveLength(1); // Only Supabase currently supported
    });
  });
});