import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('Integration workflows', () => {
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

  it('should complete full project initialization workflow', () => {
    // 1. Initialize project
    const initOutput = execSync(`${cli} init my-app`, { encoding: 'utf-8' });
    expect(initOutput).toContain('Project \'my-app\' initialized');
    expect(existsSync('light.config.yml')).toBe(true);
    expect(existsSync('.light')).toBe(true);

    // 2. Check project status
    const statusOutput = execSync(`${cli} status`, { encoding: 'utf-8' });
    expect(statusOutput).toContain('my-app');

    // 3. Start development environment
    const upOutput = execSync(`${cli} up`, { encoding: 'utf-8' });
    expect(upOutput).toContain('Ready to proxy');

    // 4. Stop development environment
    const downOutput = execSync(`${cli} down`, { encoding: 'utf-8' });
    expect(downOutput).toContain('stopped');
  });

  it('should handle complete environment management workflow', () => {
    // 1. Initialize project
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // 2. Add production environment
    const addOutput = execSync(`${cli} env add production --host prod.example.com --domain example.com --ssl-email admin@example.com`, { encoding: 'utf-8' });
    expect(addOutput).toContain('Added \'production\' environment');

    // 3. List environments
    const listOutput = execSync(`${cli} env list`, { encoding: 'utf-8' });
    expect(listOutput).toContain('production');
    expect(listOutput).toContain('prod.example.com');
    expect(listOutput).toContain('example.com');

    // 4. Validate deployment config
    const deployOutput = execSync(`${cli} deploy production --dry-run`, { encoding: 'utf-8' });
    expect(deployOutput).toContain('DRY RUN MODE');
    expect(deployOutput).toContain('production');

    // 5. Remove environment
    const removeOutput = execSync(`${cli} env remove production --force`, { encoding: 'utf-8' });
    expect(removeOutput).toContain('Removed \'production\' environment');

    // 6. Verify removal
    const listAfterRemove = execSync(`${cli} env list`, { encoding: 'utf-8' });
    expect(listAfterRemove).not.toContain('production');
  });

  it('should handle Supabase project workflow', () => {
    // 1. Initialize Lightstack project
    execSync(`${cli} init supabase-app`, { encoding: 'utf-8' });

    // 2. Create Supabase structure
    mkdirSync('supabase');
    writeFileSync('supabase/config.toml', `[api]
db_url = "postgresql://postgres:postgres@db:5432/postgres"
port = 54321

[studio]
port = 54323
`);

    // 3. Start with BaaS detection
    const upOutput = execSync(`${cli} up`, { encoding: 'utf-8' });
    expect(upOutput).toContain('BaaS services detected: Supabase');
    expect(upOutput).toContain('api.lvh.me');
    expect(upOutput).toContain('studio.lvh.me');

    // 4. Check status shows BaaS services
    const statusOutput = execSync(`${cli} status`, { encoding: 'utf-8' });
    expect(statusOutput).toContain('supabase-app');

    // 5. Stop environment
    execSync(`${cli} down`, { encoding: 'utf-8' });
  });

  it('should handle development to production workflow', () => {
    // 1. Initialize and configure for production
    execSync(`${cli} init prod-ready-app`, { encoding: 'utf-8' });
    execSync(`${cli} env add staging --host staging.example.com --domain staging.example.com`, { encoding: 'utf-8' });
    execSync(`${cli} env add production --host prod.example.com --domain example.com --ssl-email admin@example.com`, { encoding: 'utf-8' });

    // 2. Test staging deployment
    const stagingOutput = execSync(`${cli} deploy staging --dry-run`, { encoding: 'utf-8' });
    expect(stagingOutput).toContain('staging');
    expect(stagingOutput).toContain('staging.example.com');

    // 3. Test production deployment
    const prodOutput = execSync(`${cli} deploy production --dry-run`, { encoding: 'utf-8' });
    expect(prodOutput).toContain('production');
    expect(prodOutput).toContain('example.com');
    expect(prodOutput).toContain('SSL');

    // 4. Verify environments are properly configured
    const config = yaml.load(require('fs').readFileSync('light.config.yml', 'utf-8')) as any;
    expect(config.deployments).toHaveLength(2);
    expect(config.deployments.find((d: any) => d.name === 'staging')).toBeDefined();
    expect(config.deployments.find((d: any) => d.name === 'production')).toBeDefined();
  });

  it('should handle multi-service application workflow', () => {
    // 1. Initialize project
    execSync(`${cli} init multi-service-app`, { encoding: 'utf-8' });

    // 2. Update config to include multiple services
    const config = {
      name: 'multi-service-app',
      services: [
        { name: 'frontend', type: 'nuxt', port: 3000 },
        { name: 'admin', type: 'sveltekit', port: 4000 },
        { name: 'api', type: 'express', port: 8000 }
      ]
    };
    writeFileSync('light.config.yml', yaml.dump(config));

    // 3. Start multi-service environment
    const upOutput = execSync(`${cli} up`, { encoding: 'utf-8' });
    expect(upOutput).toContain('Ready to proxy');

    // 4. Check status shows all services
    const statusOutput = execSync(`${cli} status`, { encoding: 'utf-8' });
    expect(statusOutput).toContain('multi-service-app');

    // 5. Check logs for specific service
    const logsOutput = execSync(`${cli} logs frontend`, { encoding: 'utf-8' });
    expect(logsOutput).toBeDefined();

    // 6. Stop environment
    execSync(`${cli} down`, { encoding: 'utf-8' });
  });

  it('should handle error recovery workflow', () => {
    // 1. Try to run commands without project
    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow(/No Lightstack project found/i);

    expect(() => {
      execSync(`${cli} status`, { encoding: 'utf-8' });
    }).toThrow(/No Lightstack project found/i);

    // 2. Initialize project
    execSync(`${cli} init recovery-test`, { encoding: 'utf-8' });

    // 3. Try to deploy to non-existent environment
    expect(() => {
      execSync(`${cli} deploy nonexistent`, { encoding: 'utf-8' });
    }).toThrow(/Environment.*nonexistent.*not found/i);

    // 4. Add environment and try again
    execSync(`${cli} env add test --host test.example.com --domain test.example.com`, { encoding: 'utf-8' });
    const deployOutput = execSync(`${cli} deploy test --dry-run`, { encoding: 'utf-8' });
    expect(deployOutput).toContain('test');
  });

  it('should preserve configuration during updates', () => {
    // 1. Initialize project
    execSync(`${cli} init config-test`, { encoding: 'utf-8' });

    // 2. Add custom configuration
    const originalConfig = yaml.load(require('fs').readFileSync('light.config.yml', 'utf-8')) as any;
    originalConfig.custom = { setting: 'value' };
    writeFileSync('light.config.yml', yaml.dump(originalConfig));

    // 3. Add environment
    execSync(`${cli} env add production --host prod.example.com --domain example.com`, { encoding: 'utf-8' });

    // 4. Verify custom config is preserved
    const updatedConfig = yaml.load(require('fs').readFileSync('light.config.yml', 'utf-8')) as any;
    expect(updatedConfig.custom).toEqual({ setting: 'value' });
    expect(updatedConfig.deployments).toBeDefined();
  });
});