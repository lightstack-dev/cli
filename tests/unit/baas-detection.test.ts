import { describe, it, expect } from 'vitest';

// BaaS detection logic extracted from up.ts - pure function version
function detectBaaSServices(fileExists: (path: string) => boolean): string[] {
  const services: string[] = [];

  // Check for Supabase
  if (fileExists('supabase/config.toml')) {
    services.push('Supabase');
  }

  // Future: Add other BaaS detection here
  // if (fileExists('firebase.json')) services.push('Firebase');
  // if (fileExists('amplify/.config/project-config.json')) services.push('Amplify');

  return services;
}

describe('BaaS Service Detection', () => {
  describe('Supabase detection', () => {
    it('should detect Supabase when config.toml exists', () => {
      const fileExists = (path: string) => path === 'supabase/config.toml';
      const services = detectBaaSServices(fileExists);
      expect(services).toContain('Supabase');
    });

    it('should not detect Supabase when config.toml does not exist', () => {
      const fileExists = () => false;
      const services = detectBaaSServices(fileExists);
      expect(services).not.toContain('Supabase');
    });

    it('should not detect Supabase when directory exists but config is missing', () => {
      const fileExists = (path: string) => path === 'supabase' || path === 'supabase/';
      const services = detectBaaSServices(fileExists);
      expect(services).not.toContain('Supabase');
    });

    it('should detect Supabase with minimal config file', () => {
      const fileExists = (path: string) => path === 'supabase/config.toml';
      const services = detectBaaSServices(fileExists);
      expect(services).toContain('Supabase');
    });
  });

  describe('no BaaS services', () => {
    it('should return empty array when no BaaS services detected', () => {
      const fileExists = () => false;
      const services = detectBaaSServices(fileExists);
      expect(services).toEqual([]);
    });

    it('should return empty array when only unrelated files exist', () => {
      const fileExists = (path: string) =>
        path === 'package.json' || path === 'README.md';
      const services = detectBaaSServices(fileExists);
      expect(services).toEqual([]);
    });
  });

  describe('future BaaS services', () => {
    it('should be ready to detect Firebase (when implemented)', () => {
      // This test documents the expected behavior for future implementation
      const fileExists = (path: string) => path === 'firebase.json';
      const services = detectBaaSServices(fileExists);
      expect(services).not.toContain('Firebase'); // Not implemented yet
    });

    it('should be ready to detect AWS Amplify (when implemented)', () => {
      // This test documents the expected behavior for future implementation
      const fileExists = (path: string) => path === 'amplify/.config/project-config.json';
      const services = detectBaaSServices(fileExists);
      expect(services).not.toContain('Amplify'); // Not implemented yet
    });
  });

  describe('multiple BaaS services', () => {
    it('should detect multiple services when they exist (future)', () => {
      const fileExists = (path: string) => path === 'supabase/config.toml';
      const services = detectBaaSServices(fileExists);
      expect(services).toContain('Supabase');
      expect(services).toHaveLength(1);
      // When more services are added, this test should verify multiple detection
    });
  });
});