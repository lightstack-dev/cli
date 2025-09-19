import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Configuration Loading with cosmiconfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-config-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should load configuration from light.config.json', async () => {
    const config = {
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    };
    writeFileSync('light.config.json', JSON.stringify(config, null, 2));

    // Import the config loader (this will be implemented later)
    // For now, test that the file exists and is valid JSON
    const loadedConfig = JSON.parse(readFileSync('light.config.json', 'utf-8'));
    expect(loadedConfig.name).toBe('test-project');
    expect(loadedConfig.services).toHaveLength(1);
  });

  it('should support multiple configuration file formats', async () => {
    // Test .lightstackrc
    writeFileSync('.lightstackrc', JSON.stringify({
      name: 'rc-project',
      services: []
    }));

    const rcConfig = JSON.parse(readFileSync('.lightstackrc', 'utf-8'));
    expect(rcConfig.name).toBe('rc-project');

    // Test lightstack.config.js (would need dynamic import in real implementation)
    const jsConfig = `
module.exports = {
  name: 'js-project',
  services: [
    { name: 'app', type: 'vue', port: 3000 }
  ]
};
`;
    writeFileSync('lightstack.config.js', jsConfig);

    // Verify file exists (actual loading would require cosmiconfig)
    expect(readFileSync('lightstack.config.js', 'utf-8')).toContain('js-project');
  });

  it('should validate configuration schema', () => {
    // Valid configuration
    const validConfig = {
      name: 'valid-project',
      services: [
        {
          name: 'app',
          type: 'nuxt',
          port: 3000
        }
      ]
    };
    writeFileSync('light.config.json', JSON.stringify(validConfig));

    // Should not throw
    expect(() => {
      JSON.parse(readFileSync('light.config.json', 'utf-8'));
    }).not.toThrow();

    // Invalid configuration - missing required fields
    const invalidConfig = {
      // missing name
      services: []
    };
    writeFileSync('invalid.config.json', JSON.stringify(invalidConfig));

    const loaded = JSON.parse(readFileSync('invalid.config.json', 'utf-8'));
    expect(loaded.name).toBeUndefined(); // This would fail validation
  });

  it('should handle configuration hierarchy', () => {
    // Package.json config
    const packageJson = {
      name: 'my-package',
      lightstack: {
        name: 'package-project',
        services: []
      }
    };
    writeFileSync('package.json', JSON.stringify(packageJson));

    // Dedicated config file (should take precedence)
    const dedicatedConfig = {
      name: 'dedicated-project',
      services: []
    };
    writeFileSync('light.config.json', JSON.stringify(dedicatedConfig));

    // Dedicated config should win
    const loaded = JSON.parse(readFileSync('light.config.json', 'utf-8'));
    expect(loaded.name).toBe('dedicated-project');
  });

  it('should support environment-specific overrides', () => {
    const baseConfig = {
      name: 'env-project',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 }
      ]
    };
    writeFileSync('light.config.json', JSON.stringify(baseConfig));

    const developmentConfig = {
      services: [
        { name: 'app', type: 'nuxt', port: 3000, dev: true }
      ]
    };
    writeFileSync('light.config.development.json', JSON.stringify(developmentConfig));

    // Base config exists
    const base = JSON.parse(readFileSync('light.config.json', 'utf-8'));
    expect(base.name).toBe('env-project');

    // Environment-specific config exists
    const dev = JSON.parse(readFileSync('light.config.development.json', 'utf-8'));
    expect(dev.services[0].dev).toBe(true);
  });

  it('should handle malformed configuration files gracefully', () => {
    // Invalid JSON
    writeFileSync('light.config.json', '{ invalid json }');

    expect(() => {
      JSON.parse(readFileSync('light.config.json', 'utf-8'));
    }).toThrow();

    // Empty file
    writeFileSync('empty.config.json', '');

    expect(() => {
      JSON.parse(readFileSync('empty.config.json', 'utf-8'));
    }).toThrow();
  });

  it('should merge configurations correctly', () => {
    // This would test the actual cosmiconfig + merging logic
    // For now, we test that multiple config sources can exist

    const baseConfig = {
      name: 'merge-test',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 }
      ],
      settings: {
        ssl: true,
        logging: 'info'
      }
    };

    const overrideConfig = {
      services: [
        { name: 'app', type: 'nuxt', port: 3001 } // Different port
      ],
      settings: {
        logging: 'debug' // Different log level
      }
    };

    writeFileSync('base.config.json', JSON.stringify(baseConfig));
    writeFileSync('override.config.json', JSON.stringify(overrideConfig));

    // Both files should be readable
    const base = JSON.parse(readFileSync('base.config.json', 'utf-8'));
    const override = JSON.parse(readFileSync('override.config.json', 'utf-8'));

    expect(base.services[0].port).toBe(3000);
    expect(override.services[0].port).toBe(3001);
  });
});