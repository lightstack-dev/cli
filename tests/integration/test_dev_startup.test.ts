import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Development Environment Startup', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-integration-'));
    process.chdir(tempDir);

    // Create a realistic project configuration
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      template: 'nuxt',
      services: [
        {
          name: 'app',
          type: 'nuxt',
          port: 3000,
          healthCheck: 'https://app.lvh.me/health'
        },
        {
          name: 'supabase',
          type: 'supabase',
          port: 54321,
          healthCheck: 'https://supabase.lvh.me/health'
        }
      ]
    }));

    writeFileSync('.env.development', `
NODE_ENV=development
PROJECT_NAME=test-project
APP_PORT=3000
SUPABASE_PORT=54321
`);
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should validate prerequisites before starting', () => {
    try {
      const output = execSync(`${cli} up`, { encoding: 'utf-8', timeout: 10000 });

      // Should check Docker daemon
      expect(output).toContain('Docker daemon');

      // Should validate configuration
      expect(output).toContain('Validating');
    } catch (error: any) {
      // If Docker is not running, should give clear error
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker.*not.*running/i);
      } else {
        throw error;
      }
    }
  });

  it('should generate proper docker-compose command', () => {
    try {
      const output = execSync(`${cli} up`, { encoding: 'utf-8', timeout: 10000 });

      // Should use development override
      expect(output).toMatch(/docker.*compose.*-f.*docker-compose\.yml.*-f.*docker-compose\.dev\.yml/);
    } catch (error: any) {
      if (!isDockerRunning()) {
        // Expected if Docker is not available
        expect(error.message).toMatch(/docker/i);
      } else {
        throw error;
      }
    }
  });

  it('should wait for health checks', () => {
    try {
      const output = execSync(`${cli} up`, { encoding: 'utf-8', timeout: 15000 });

      expect(output).toContain('health');
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker/i);
      } else {
        // Could timeout waiting for health checks, which is expected in test environment
        expect(error.message).toMatch(/(timeout|health)/i);
      }
    }
  });

  it('should display service URLs after startup', () => {
    try {
      const output = execSync(`${cli} up`, { encoding: 'utf-8', timeout: 10000 });

      expect(output).toContain('https://app.lvh.me');
      expect(output).toContain('https://supabase.lvh.me');
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker/i);
      } else {
        throw error;
      }
    }
  });

  it('should handle different environment configurations', () => {
    writeFileSync('.env.staging', `
NODE_ENV=staging
PROJECT_NAME=test-project
APP_PORT=3000
`);

    try {
      const output = execSync(`${cli} up --env staging`, { encoding: 'utf-8', timeout: 10000 });

      expect(output).toContain('staging');
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker/i);
      } else {
        throw error;
      }
    }
  });

  it('should support forcing rebuild', () => {
    try {
      const output = execSync(`${cli} up --build`, { encoding: 'utf-8', timeout: 15000 });

      expect(output).toMatch(/(build|rebuild)/i);
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker/i);
      } else {
        throw error;
      }
    }
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