import { describe, it, expect } from 'vitest';
import {
  determineMode,
  getComposeFiles,
  buildDockerCommand,
  validateSSLProvider,
  type Mode,
  type SSLProvider
} from '../../src/utils/docker.js';

describe('Docker Utilities', () => {
  describe('determineMode', () => {
    it('should return development mode for "development" environment', () => {
      const mode = determineMode('development');
      expect(mode).toBe('development');
    });

    it('should return deployment mode for "production" environment', () => {
      const mode = determineMode('production');
      expect(mode).toBe('deployment');
    });

    it('should return deployment mode for "staging" environment', () => {
      const mode = determineMode('staging');
      expect(mode).toBe('deployment');
    });

    it('should return deployment mode for custom environments', () => {
      expect(determineMode('qa')).toBe('deployment');
      expect(determineMode('preview')).toBe('deployment');
      expect(determineMode('my-custom-env')).toBe('deployment');
    });

    it('should handle case sensitivity', () => {
      expect(determineMode('Development')).toBe('deployment'); // Not 'development'
      expect(determineMode('DEVELOPMENT')).toBe('deployment'); // Not 'development'
    });
  });

  describe('getComposeFiles', () => {
    it('should return base and development files for development environment', () => {
      const files = getComposeFiles('development');

      expect(files).toHaveLength(2);
      expect(files[0]).toBe('.light/docker-compose.yml');
      expect(files[1]).toBe('.light/docker-compose.development.yml');
    });

    it('should return base, deployment, and supabase files for deployment environments', () => {
      const files = getComposeFiles('production');

      expect(files).toHaveLength(3);
      expect(files[0]).toBe('.light/docker-compose.yml');
      expect(files[1]).toBe('.light/docker-compose.deployment.yml');
      expect(files[2]).toBe('.light/docker-compose.supabase.yml');
    });

    it('should return deployment files for staging environment', () => {
      const files = getComposeFiles('staging');

      expect(files).toContain('.light/docker-compose.yml');
      expect(files).toContain('.light/docker-compose.deployment.yml');
      expect(files).toContain('.light/docker-compose.supabase.yml');
    });

    it('should maintain correct file order', () => {
      const devFiles = getComposeFiles('development');
      expect(devFiles[0]).toBe('.light/docker-compose.yml'); // Base first

      const prodFiles = getComposeFiles('production');
      expect(prodFiles[0]).toBe('.light/docker-compose.yml'); // Base first
      expect(prodFiles[prodFiles.length - 1]).toBe('.light/docker-compose.supabase.yml'); // Supabase last
    });
  });

  describe('buildDockerCommand', () => {
    it('should build basic command with single compose file', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        'up',
        { detach: true, service: undefined }
      );

      expect(cmd).toContain('docker compose');
      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('up -d');
    });

    it('should build command with multiple compose files', () => {
      const cmd = buildDockerCommand(
        [
          '.light/docker-compose.yml',
          '.light/docker-compose.deployment.yml',
          '.light/docker-compose.supabase.yml'
        ],
        'up',
        { detach: true }
      );

      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('-f .light/docker-compose.deployment.yml');
      expect(cmd).toContain('-f .light/docker-compose.supabase.yml');
    });

    it('should include detach flag when detach is true', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        'up',
        { detach: true }
      );

      expect(cmd).toContain('up -d');
    });

    it('should omit detach flag when detach is false', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        'up',
        { detach: false }
      );

      expect(cmd).toContain('up');
      expect(cmd).not.toContain('-d');
    });

    it('should include service name when provided', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        'up',
        { detach: true, service: 'traefik' }
      );

      expect(cmd).toContain('up -d traefik');
    });

    it('should handle service name without detach', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        'up',
        { detach: false, service: 'postgres' }
      );

      expect(cmd).toContain('up postgres');
      expect(cmd).not.toContain('-d');
    });

    it('should maintain correct argument order', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml', '.light/docker-compose.deployment.yml'],
        'up',
        { detach: true }
      );

      const fileIndex = cmd.indexOf('-f');
      const upIndex = cmd.indexOf('up');

      expect(fileIndex).toBeLessThan(upIndex);
    });

    it('should support different commands', () => {
      const upCmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        'up',
        { detach: true }
      );
      const downCmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        'down',
        {}
      );

      expect(upCmd).toMatch(/docker compose .* up/);
      expect(downCmd).toMatch(/docker compose .* down/);
    });
  });

  describe('validateSSLProvider', () => {
    it('should return mkcert for valid mkcert input', () => {
      const provider = validateSSLProvider('mkcert');
      expect(provider).toBe('mkcert');
    });

    it('should return letsencrypt for valid letsencrypt input', () => {
      const provider = validateSSLProvider('letsencrypt');
      expect(provider).toBe('letsencrypt');
    });

    it('should default to mkcert when undefined', () => {
      const provider = validateSSLProvider(undefined);
      expect(provider).toBe('mkcert');
    });

    it('should throw error for invalid provider', () => {
      expect(() => validateSSLProvider('invalid')).toThrow('Invalid SSL provider');
      expect(() => validateSSLProvider('invalid')).toThrow('Must be \'mkcert\' or \'letsencrypt\'');
    });

    it('should be case sensitive', () => {
      expect(() => validateSSLProvider('Mkcert')).toThrow();
      expect(() => validateSSLProvider('LETSENCRYPT')).toThrow();
    });

    it('should treat empty string as default mkcert', () => {
      const provider = validateSSLProvider('');
      expect(provider).toBe('mkcert');
    });

    it('should have correct type safety', () => {
      const provider: SSLProvider = validateSSLProvider('mkcert');
      expect(['mkcert', 'letsencrypt']).toContain(provider);
    });
  });

  describe('integration: mode detection with compose file selection', () => {
    it('should select correct files for development mode', () => {
      const mode = determineMode('development');
      const files = getComposeFiles('development');

      expect(mode).toBe('development');
      expect(files).toHaveLength(2);
      expect(files).toContain('.light/docker-compose.development.yml');
    });

    it('should select correct files for deployment mode', () => {
      const mode = determineMode('production');
      const files = getComposeFiles('production');

      expect(mode).toBe('deployment');
      expect(files).toContain('.light/docker-compose.deployment.yml');
      expect(files).toContain('.light/docker-compose.supabase.yml');
    });

    it('should build correct command for development environment', () => {
      const files = getComposeFiles('development');
      const cmd = buildDockerCommand(files, 'up', { detach: true });

      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('-f .light/docker-compose.development.yml');
      expect(cmd).not.toContain('supabase');
    });

    it('should build correct command for deployment environment', () => {
      const files = getComposeFiles('production');
      const cmd = buildDockerCommand(files, 'up', { detach: true });

      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('-f .light/docker-compose.deployment.yml');
      expect(cmd).toContain('-f .light/docker-compose.supabase.yml');
    });
  });
});
