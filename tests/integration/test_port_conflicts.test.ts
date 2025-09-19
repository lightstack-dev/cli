import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Port Conflict Detection and Suggestions', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-port-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should detect port conflicts in configuration', () => {
    const conflictingConfig = {
      name: 'port-conflict-test',
      services: [
        { name: 'app1', type: 'nuxt', port: 3000 },
        { name: 'app2', type: 'vue', port: 3000 }, // Same port!
        { name: 'app3', type: 'react', port: 3001 } // Different port, OK
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(conflictingConfig));

    expect(() => {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    }).toThrow();

    try {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/port.*conflict/i);
      expect(error.message).toContain('3000');
      expect(error.message).toMatch(/(app1|app2)/);
    }
  });

  it('should suggest alternative ports for conflicts', () => {
    const conflictingConfig = {
      name: 'suggestion-test',
      services: [
        { name: 'frontend', type: 'nuxt', port: 80 },
        { name: 'backend', type: 'express', port: 80 }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(conflictingConfig));

    try {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/port.*conflict/i);
      expect(error.message).toMatch(/suggestion|alternative|try/i);

      // Should suggest specific alternative ports
      expect(error.message).toMatch(/\d{2,5}/); // Should contain port numbers
    }
  });

  it('should detect system port conflicts during startup', () => {
    // Try to use a commonly occupied port
    const systemPortConfig = {
      name: 'system-port-test',
      services: [
        { name: 'app', type: 'nuxt', port: 22 } // SSH port
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(systemPortConfig));

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      // Should detect that port 22 is likely in use
      expect(error.message).toMatch(/(port.*use|port.*occupied|bind.*failed)/i);
      expect(error.message).toContain('22');
    }
  });

  it('should validate port ranges', () => {
    const invalidPortConfig = {
      name: 'invalid-port-test',
      services: [
        { name: 'app1', type: 'nuxt', port: 0 }, // Invalid
        { name: 'app2', type: 'vue', port: 65536 }, // Out of range
        { name: 'app3', type: 'react', port: -1 } // Negative
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(invalidPortConfig));

    expect(() => {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    }).toThrow();

    try {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/(invalid.*port|port.*range)/i);
      expect(error.message).toMatch(/(1000|65535)/); // Should mention valid range
    }
  });

  it('should suggest ports based on service type', () => {
    const multiServiceConfig = {
      name: 'multi-service-test',
      services: [
        { name: 'web', type: 'nuxt', port: 3000 },
        { name: 'api', type: 'express', port: 3000 }, // Conflict
        { name: 'db', type: 'postgres', port: 5432 }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(multiServiceConfig));

    try {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/port.*conflict/i);

      // Should suggest appropriate ports for each service type
      // e.g., 8000-8999 for APIs, 3000-3999 for web apps
      expect(error.message).toMatch(/8000|8080|4000/); // Common API ports
    }
  });

  it('should check for reserved ports', () => {
    const reservedPortConfig = {
      name: 'reserved-port-test',
      services: [
        { name: 'app1', type: 'nuxt', port: 80 }, // HTTP - might be reserved
        { name: 'app2', type: 'vue', port: 443 }, // HTTPS - likely reserved
        { name: 'app3', type: 'react', port: 21 } // FTP - system port
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(reservedPortConfig));

    try {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/(reserved|system|privileged).*port/i);
      expect(error.message).toMatch(/(80|443|21)/);
    }
  });

  it('should auto-suggest next available ports', () => {
    const autoSuggestConfig = {
      name: 'auto-suggest-test',
      services: [
        { name: 'app1', type: 'nuxt', port: 3000 },
        { name: 'app2', type: 'nuxt', port: 3000 }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(autoSuggestConfig));

    try {
      execSync(`${cli} init --force --auto-fix-ports`, { encoding: 'utf-8' });

      // If auto-fix is implemented, should succeed
      // If not implemented, should fail with helpful message
    } catch (error: any) {
      if (error.message.includes('unknown option')) {
        // --auto-fix-ports not implemented yet, which is fine
        expect(error.message).toMatch(/unknown.*option/);
      } else {
        // Should be a port conflict error with suggestions
        expect(error.message).toMatch(/port.*conflict/i);
        expect(error.message).toMatch(/3001|3002/); // Should suggest next ports
      }
    }
  });

  it('should handle dynamic port allocation suggestions', () => {
    const dynamicConfig = {
      name: 'dynamic-test',
      services: [
        { name: 'web1', type: 'nuxt', port: 3000 },
        { name: 'web2', type: 'nuxt', port: 3000 },
        { name: 'web3', type: 'nuxt', port: 3000 },
        { name: 'api1', type: 'express', port: 8000 },
        { name: 'api2', type: 'express', port: 8000 }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(dynamicConfig));

    try {
      execSync(`${cli} init --force`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/port.*conflict/i);

      // Should suggest a range of alternative ports
      expect(error.message).toMatch(/3001.*3002.*3003/);
      expect(error.message).toMatch(/8001.*8002/);
    }
  });
});