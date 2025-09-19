import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('light status command', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-test-'));
    process.chdir(tempDir);
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [
        { name: 'app', type: 'nuxt', port: 3000 },
        { name: 'database', type: 'supabase', port: 5432 }
      ]
    }));
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should show project and service status', () => {
    const output = execSync(`${cli} status`, { encoding: 'utf-8' });

    expect(output).toContain('Project: test-project');
    expect(output).toContain('Services:');
    expect(output).toContain('app');
    expect(output).toContain('database');
  });

  it('should display service status in table format by default', () => {
    const output = execSync(`${cli} status`, { encoding: 'utf-8' });

    // Check for table-like formatting
    expect(output).toMatch(/Service.*Status.*URL.*Health/);
    expect(output).toContain('│'); // Table border character
  });

  it('should support --format json option', () => {
    const output = execSync(`${cli} status --format json`, { encoding: 'utf-8' });

    const json = JSON.parse(output);
    expect(json).toHaveProperty('project');
    expect(json).toHaveProperty('services');
    expect(Array.isArray(json.services)).toBe(true);
  });

  it('should show container status for each service', () => {
    const output = execSync(`${cli} status`, { encoding: 'utf-8' });

    // Should show running/stopped status
    expect(output).toMatch(/(running|stopped|not started)/i);
  });

  it('should show service URLs', () => {
    const output = execSync(`${cli} status`, { encoding: 'utf-8' });

    expect(output).toContain('https://');
    expect(output).toMatch(/localhost|lvh\.me/);
  });

  it('should show deployment targets if configured', () => {
    writeFileSync('light.config.json', JSON.stringify({
      name: 'test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }],
      deployments: [
        { name: 'production', host: 'prod.example.com' },
        { name: 'staging', host: 'staging.example.com' }
      ]
    }));

    const output = execSync(`${cli} status`, { encoding: 'utf-8' });

    expect(output).toContain('Deployment Targets:');
    expect(output).toContain('production');
    expect(output).toContain('staging');
  });

  it('should handle missing project gracefully', () => {
    rmSync('light.config.json');

    expect(() => {
      execSync(`${cli} status`, { encoding: 'utf-8' });
    }).toThrow(/no.*project/i);
  });
});