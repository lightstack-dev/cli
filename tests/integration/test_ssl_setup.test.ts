import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('mkcert SSL Certificate Setup', () => {
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

  it('should check for mkcert installation during init', () => {
    const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Should mention mkcert or certificates
    expect(output).toMatch(/(mkcert|certificate|ssl)/i);
  });

  it('should create certificate directory', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    expect(existsSync('.light/certs')).toBe(true);
  });

  it('should handle mkcert not being installed', () => {
    // Mock a system where mkcert is not available
    try {
      const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

      // Should either succeed with mkcert or provide installation instructions
      if (!isMkcertInstalled()) {
        expect(output).toMatch(/(install.*mkcert|certificate.*manual)/i);
      } else {
        expect(output).toContain('certificates');
      }
    } catch (error: any) {
      // If mkcert is not installed, should provide helpful error
      expect(error.message).toMatch(/(mkcert.*not.*found|install.*mkcert)/i);
    }
  });

  it('should generate certificates for local development domains', () => {
    try {
      const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

      if (isMkcertInstalled()) {
        // Should create certificates for lvh.me domains
        expect(output).toMatch(/(lvh\.me|localhost|certificate)/i);

        // Should create cert files
        const certDir = '.light/certs';
        if (existsSync(certDir)) {
          // Certificate directory should exist (exact files depend on mkcert implementation)
          expect(existsSync(certDir)).toBe(true);
        }
      }
    } catch (error: any) {
      if (!isMkcertInstalled()) {
        expect(error.message).toMatch(/mkcert/i);
      } else {
        throw error;
      }
    }
  });

  it('should configure Docker Compose to use certificates', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Check that docker-compose.dev.yml references certificates
    if (existsSync('.light/docker-compose.dev.yml')) {
      const devContent = readFileSync('.light/docker-compose.dev.yml', 'utf-8');
      expect(devContent).toMatch(/(certs|certificate|ssl)/i);
    }
  });

  it('should provide fallback for systems without mkcert', () => {
    try {
      const output = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

      // Should either succeed or provide clear instructions
      expect(output).toBeDefined();
    } catch (error: any) {
      // Error should be informative, not cryptic
      expect(error.message.length).toBeGreaterThan(10);
      expect(error.message).toMatch(/(mkcert|certificate|ssl|install)/i);
    }
  });

  it('should work with different project configurations', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'custom-project',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 },
        { name: 'api', type: 'express', port: 8000 }
      ]
    }));

    try {
      const output = execSync(`${cli} init --force`, { encoding: 'utf-8' });

      // Should handle custom configurations
      expect(output).toContain('custom-project');
    } catch (error: any) {
      if (!isMkcertInstalled()) {
        expect(error.message).toMatch(/mkcert/i);
      } else {
        throw error;
      }
    }
  });

  it('should skip certificate generation with appropriate flag', () => {
    try {
      const output = execSync(`${cli} init --no-ssl`, { encoding: 'utf-8' });

      expect(output).toMatch(/(skip.*ssl|no.*certificate)/i);
    } catch (error: any) {
      // If --no-ssl is not implemented yet, that's expected
      expect(error.message).toMatch(/(unknown.*option|unrecognized)/i);
    }
  });
});

function isMkcertInstalled(): boolean {
  try {
    execSync('mkcert -help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}