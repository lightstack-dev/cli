import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('light env command', () => {
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
  });

  afterEach(() => {
    process.chdir(originalDir);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should list environments when none configured', () => {
    const output = execSync(`${cli} env list`, { encoding: 'utf-8' });

    expect(output).toContain('No deployment environments configured');
    expect(output).toContain('light env add production');
  });

  it('should list configured environments', () => {
    // Add some environments to the config
    writeFileSync('light.config.yml', yaml.dump({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [
        {
          name: 'production',
          host: 'prod.example.com',
          domain: 'myapp.com',
          user: 'deploy',
          port: 22,
          ssl: {
            enabled: true,
            provider: 'letsencrypt'
          }
        },
        {
          name: 'staging',
          host: 'staging.example.com',
          domain: 'staging.myapp.com'
        }
      ]
    }));

    const output = execSync(`${cli} env list`, { encoding: 'utf-8' });

    expect(output).toContain('production');
    expect(output).toContain('prod.example.com');
    expect(output).toContain('myapp.com');
    expect(output).toContain('staging');
    expect(output).toContain('staging.example.com');
  });

  it('should add environment via command line options', () => {
    execSync(`${cli} env add production --host prod.server.com --domain example.com --user deploy --port 2222 --no-ssl`, { encoding: 'utf-8' });

    const config = yaml.load(readFileSync('light.config.yml', 'utf-8')) as any;

    expect(config.deployments).toBeDefined();
    expect(config.deployments).toHaveLength(1);
    expect(config.deployments[0].name).toBe('production');
    expect(config.deployments[0].host).toBe('prod.server.com');
    expect(config.deployments[0].domain).toBe('example.com');
    expect(config.deployments[0].user).toBe('deploy');
    expect(config.deployments[0].port).toBe(2222);
  });

  it('should reject duplicate environment names', () => {
    // Add an environment first
    execSync(`${cli} env add production --host prod.server.com --domain example.com --no-ssl`, { encoding: 'utf-8' });

    // Try to add it again
    expect(() => {
      execSync(`${cli} env add production --host another.server.com --domain another.com --no-ssl`, { encoding: 'utf-8' });
    }).toThrow(/already exists/i);
  });

  it('should validate environment name format', () => {
    expect(() => {
      execSync(`${cli} env add "Invalid Name!" --host server.com --domain example.com --no-ssl`, { encoding: 'utf-8' });
    }).toThrow(/must contain only lowercase/i);
  });

  it('should remove environment', () => {
    // Add an environment first
    execSync(`${cli} env add production --host prod.server.com --domain example.com --no-ssl`, { encoding: 'utf-8' });

    // Remove it with force flag to skip confirmation
    execSync(`${cli} env remove production --force`, { encoding: 'utf-8' });

    const config = yaml.load(readFileSync('light.config.yml', 'utf-8')) as any;
    expect(config.deployments).toBeUndefined();
  });

  it('should error when removing non-existent environment', () => {
    expect(() => {
      execSync(`${cli} env remove nonexistent --force`, { encoding: 'utf-8' });
    }).toThrow(/not found/i);
  });

  it('should support env command aliases', () => {
    // Test 'envs' alias
    const output1 = execSync(`${cli} envs list`, { encoding: 'utf-8' });
    expect(output1).toContain('No deployment environments configured');

    // Test 'environments' alias
    const output2 = execSync(`${cli} environments list`, { encoding: 'utf-8' });
    expect(output2).toContain('No deployment environments configured');
  });

  it('should support remove command aliases', () => {
    // Add an environment first
    execSync(`${cli} env add test1 --host server1.com --domain test1.com --no-ssl`, { encoding: 'utf-8' });
    execSync(`${cli} env add test2 --host server2.com --domain test2.com --no-ssl`, { encoding: 'utf-8' });
    execSync(`${cli} env add test3 --host server3.com --domain test3.com --no-ssl`, { encoding: 'utf-8' });

    // Test 'rm' alias
    execSync(`${cli} env rm test1 --force`, { encoding: 'utf-8' });

    // Test 'delete' alias
    execSync(`${cli} env delete test2 --force`, { encoding: 'utf-8' });

    const config = yaml.load(readFileSync('light.config.yml', 'utf-8')) as any;
    expect(config.deployments).toHaveLength(1);
    expect(config.deployments[0].name).toBe('test3');
  });

  it('should preserve other config when adding environments', () => {
    const originalConfig = {
      name: 'test-project',
      version: '1.0.0',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 },
        { name: 'api', type: 'express', port: 4000 }
      ],
      customField: 'should-be-preserved'
    };

    writeFileSync('light.config.yml', yaml.dump(originalConfig));

    execSync(`${cli} env add production --host prod.server.com --domain example.com --no-ssl`, { encoding: 'utf-8' });

    const config = yaml.load(readFileSync('light.config.yml', 'utf-8')) as any;

    // Check original fields are preserved
    expect(config.name).toBe('test-project');
    expect(config.version).toBe('1.0.0');
    expect(config.services).toHaveLength(2);
    expect(config.customField).toBe('should-be-preserved');

    // Check new deployment was added
    expect(config.deployments).toHaveLength(1);
  });

  it('should handle missing project gracefully', () => {
    rmSync('light.config.yml');

    expect(() => {
      execSync(`${cli} env list`, { encoding: 'utf-8' });
    }).toThrow(/No Lightstack project found/i);
  });
});