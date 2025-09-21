import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('light deploy command', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    // Create a project with deployment configuration
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [{
        name: 'production',
        host: 'example.com',
        domain: 'myapp.com',
        ssl: {
          enabled: true,
          provider: 'letsencrypt',
          email: 'test@example.com'
        }
      }]
    }));
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should deploy to default environment (production)', () => {
    const output = execSync(`${cli} deploy --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('production');
    expect(output).toContain('Building containers');
    expect(output).toContain('Uploading');
  });

  it('should deploy to specified environment', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [
        {
          name: 'staging',
          host: 'staging.example.com',
          domain: 'staging.myapp.com'
        }
      ]
    }));

    const output = execSync(`${cli} deploy staging --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('staging');
    expect(output).toContain('staging.example.com');
  });

  it('should support --dry-run flag', () => {
    const output = execSync(`${cli} deploy --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('dry run');
    expect(output).toContain('would be deployed');
    expect(output).not.toContain('Deployment complete');
  });

  it('should support --build flag', () => {
    const output = execSync(`${cli} deploy --build --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('Force rebuild');
  });

  it('should support --rollback flag', () => {
    const output = execSync(`${cli} deploy --rollback --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('rollback');
  });

  it('should validate environment exists', () => {
    expect(() => {
      execSync(`${cli} deploy nonexistent`, { encoding: 'utf-8' });
    }).toThrow(/environment.*not.*configured/i);
  });

  it('should validate deployment prerequisites', () => {
    const output = execSync(`${cli} deploy --dry-run`, { encoding: 'utf-8' });

    expect(output).toContain('Validating');
    expect(output).toContain('SSH access');
    expect(output).toContain('Docker');
  });

  it('should handle deployment failures gracefully', () => {
    // Simulate a deployment that would fail
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [{
        name: 'production',
        host: 'invalid.host.that.does.not.exist.local'
      }]
    }));

    expect(() => {
      execSync(`${cli} deploy`, { encoding: 'utf-8', timeout: 5000 });
    }).toThrow();
  });
});