import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('Configuration validation', () => {
  let tempDir: string;
  let originalDir: string;
  const cli = `node ${join(__dirname, '..', '..', 'dist', 'cli.js')}`;

  beforeEach(() => {
    originalDir = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should validate project name during init', () => {
    expect(() => {
      execSync(`${cli} init "invalid project name"`, { encoding: 'utf-8' });
    }).toThrow(/project name/i);
  });

  it('should validate light.config.yml schema', () => {
    // Create invalid configuration
    writeFileSync('light.config.yml', yaml.dump({
      // Missing required 'name' field
      services: [{ name: 'app', type: 'nuxt' }] // Missing required 'port' field
    }));

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should validate service configuration', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [
        { name: 'app' } // Missing type and port
      ]
    }));

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/service.*configuration/i);
  });

  it('should validate deployment configuration', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [
        { name: 'production' } // Missing required host field
      ]
    }));

    expect(() => {
      execSync(`${cli} deploy production --dry-run`, { encoding: 'utf-8' });
    }).toThrow(/host.*required/i);
  });

  it('should validate port conflicts', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [
        { name: 'app1', type: 'nuxt', port: 3000 },
        { name: 'app2', type: 'sveltekit', port: 3000 } // Same port
      ]
    }));

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/port.*conflict/i);
  });

  it('should validate environment names', () => {
    expect(() => {
      execSync(`${cli} env add "Invalid Name"`, { encoding: 'utf-8' });
    }).toThrow(/environment name/i);

    expect(() => {
      execSync(`${cli} env add "invalid@name"`, { encoding: 'utf-8' });
    }).toThrow(/environment name/i);
  });

  it('should validate SSL configuration', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [
        {
          name: 'production',
          host: 'example.com',
          domain: 'myapp.com',
          ssl: {
            enabled: true
            // Missing required email field for Let's Encrypt
          }
        }
      ]
    }));

    expect(() => {
      execSync(`${cli} deploy production --dry-run`, { encoding: 'utf-8' });
    }).toThrow(/ssl.*email/i);
  });

  it('should validate Docker prerequisites', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    }));

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      if (!isDockerRunning()) {
        expect(error.message).toMatch(/docker.*not.*running/i);
      }
    }
  });

  it('should validate project structure', () => {
    // No light.config.yml file
    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/No Lightstack project found/i);

    expect(() => {
      execSync(`${cli} status`, { encoding: 'utf-8' });
    }).toThrow(/No Lightstack project found/i);
  });

  it('should validate service types', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [
        { name: 'app', type: 'unsupported-framework', port: 3000 }
      ]
    }));

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/service type/i);
  });

  it('should provide helpful error messages for common mistakes', () => {
    // Test YAML syntax error
    writeFileSync('light.config.yml', 'invalid: yaml: syntax [[[');

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/configuration.*invalid/i);
  });

  it('should validate deployment environment exists before deploy', () => {
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
      // No deployments array
    }));

    expect(() => {
      execSync(`${cli} deploy production`, { encoding: 'utf-8' });
    }).toThrow(/Environment.*production.*not found/i);
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