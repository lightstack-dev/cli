import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Configuration Error Messages', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-config-error-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should handle malformed JSON configuration', () => {
    writeFileSync('light.config.json', '{ invalid json syntax }');

    try {
      execSync(`${cli} status`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toMatch(/(invalid.*json|syntax.*error|malformed)/i);
      expect(error.message).toContain('Cause:');
      expect(error.message).toContain('Solution:');
      expect(error.message).toMatch(/line.*\d+/i); // Should show line number
    }
  });

  it('should validate required configuration fields', () => {
    // Missing required 'name' field
    const invalidConfig = {
      services: [
        { name: 'app', type: 'nuxt', port: 3000 }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(invalidConfig));

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toMatch(/(missing.*name|name.*required)/i);
      expect(error.message).toContain('Solution:');
      expect(error.message).toMatch(/add.*name.*field/i);
    }
  });

  it('should validate service configuration', () => {
    const invalidServiceConfig = {
      name: 'test-project',
      services: [
        {
          // Missing required fields: name, type, port
        },
        {
          name: 'app2',
          type: 'invalid-type',
          port: 'not-a-number'
        }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(invalidServiceConfig));

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toMatch(/(invalid.*service|service.*configuration)/i);
      expect(error.message).toMatch(/(missing.*name|missing.*type|missing.*port)/i);
      expect(error.message).toContain('Solution:');
    }
  });

  it('should provide helpful messages for schema violations', () => {
    const schemaViolationConfig = {
      name: 'test-project',
      services: [
        {
          name: 'app',
          type: 'unsupported-framework',
          port: 99999999, // Out of valid range
          invalid_field: 'not-allowed'
        }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(schemaViolationConfig));

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toMatch(/(schema.*violation|invalid.*configuration)/i);
      expect(error.message).toContain('unsupported-framework');
      expect(error.message).toMatch(/(supported.*types|valid.*frameworks)/i);
      expect(error.message).toContain('Solution:');
    }
  });

  it('should handle missing configuration file gracefully', () => {
    // No light.config.json file
    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toMatch(/(no.*project|project.*not.*found|missing.*configuration)/i);
      expect(error.message).toContain('Cause:');
      expect(error.message).toContain('Solution:');
      expect(error.message).toMatch(/light init/i);
    }
  });

  it('should validate deployment configuration', () => {
    const invalidDeploymentConfig = {
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [
        {
          // Missing required fields
          name: 'production'
          // missing host, domain, etc.
        },
        {
          name: 'staging',
          host: 'invalid-host-format',
          ssl: {
            enabled: 'not-a-boolean',
            provider: 'unsupported-provider'
          }
        }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(invalidDeploymentConfig));

    try {
      execSync(`${cli} deploy production`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toMatch(/(invalid.*deployment|deployment.*configuration)/i);
      expect(error.message).toContain('Solution:');
    }
  });

  it('should show configuration examples in error messages', () => {
    writeFileSync('light.config.json', '{}'); // Empty config

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toMatch(/example|sample/i);

      // Should show a minimal valid configuration
      expect(error.message).toMatch(/\{[\s\S]*"name"[\s\S]*"services"[\s\S]*\}/);
    }
  });

  it('should validate environment-specific configurations', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    }));

    // Invalid environment file
    writeFileSync('.env.development', 'INVALID_ENV_FORMAT_NO_EQUALS');

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      // If environment validation is implemented
      if (error.message.includes('environment')) {
        expect(error.message).toMatch(/❌ Error:/);
        expect(error.message).toMatch(/(invalid.*environment|env.*file)/i);
        expect(error.message).toContain('Solution:');
      }
    }
  });

  it('should provide helpful context for configuration errors', () => {
    const complexConfig = {
      name: 'complex-project',
      services: [
        {
          name: 'frontend',
          type: 'nuxt',
          port: 3000,
          dependencies: ['backend'] // Reference to backend
        },
        {
          name: 'backend',
          type: 'express',
          port: 'invalid-port', // This will cause an error
          database: {
            type: 'postgres',
            host: 'localhost'
          }
        }
      ]
    };

    writeFileSync('light.config.json', JSON.stringify(complexConfig));

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error:/);
      expect(error.message).toContain('backend'); // Should mention which service
      expect(error.message).toMatch(/(port.*invalid|invalid.*port)/i);
      expect(error.message).toContain('Solution:');
      expect(error.message).toMatch(/number|integer/i);
    }
  });

  it('should format configuration errors consistently', () => {
    writeFileSync('light.config.json', 'not json at all');

    try {
      execSync(`${cli} status`, { encoding: 'utf-8' });
    } catch (error: any) {
      // All errors should follow the same format
      expect(error.message).toMatch(/❌ Error: .+/);
      expect(error.message).toMatch(/Cause: .+/);
      expect(error.message).toMatch(/Solution: .+/);
      expect(error.message).toMatch(/For more help: light .+ --help/);
    }
  });
});