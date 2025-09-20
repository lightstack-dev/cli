import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

// Helper function to check if Docker is available
function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('Full CLI Workflow Integration', () => {
  let tempDir: string;
  let originalCwd: string;
  const projectRoot = join(__dirname, '..', '..');
  const cli = `node "${join(projectRoot, 'dist', 'cli.js')}"`; // Use built CLI with absolute path

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-workflow-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should complete full init → up → down workflow', () => {
    // Step 1: Initialize project (doesn't require Docker)
    const initOutput = execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    expect(initOutput).toContain('test-project');
    expect(initOutput).toContain('✅');

    // Verify YAML configuration is created
    expect(existsSync('light.config.yaml')).toBe(true);

    const config = yaml.load(readFileSync('light.config.yaml', 'utf-8')) as any;
    expect(config.name).toBe('test-project');
    expect(config.services).toBeDefined();
    expect(Array.isArray(config.services)).toBe(true);
    expect(config.services[0].name).toBe('app');
    expect(config.services[0].type).toBe('nuxt');
    expect(config.services[0].port).toBe(3000);

    // Verify Docker Compose files are created
    expect(existsSync('.light/docker-compose.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.dev.yml')).toBe(true);
    expect(existsSync('.light/docker-compose.prod.yml')).toBe(true);

    // Verify Traefik static configuration (if created)
    // Note: Traefik config might not be created in init, could be created in up command

    // Verify certs directory is created
    expect(existsSync('.light/certs')).toBe(true);

    // Create a mock Dockerfile to satisfy prerequisites
    writeFileSync('Dockerfile', `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
`);

    // Skip Docker-dependent tests if Docker is not available
    if (!isDockerAvailable()) {
      console.log('⚠️ Skipping Docker-dependent tests - Docker not available');
      return;
    }

    // Step 2: Start environment (up command) - requires Docker
    const upOutput = execSync(`${cli} up`, { encoding: 'utf-8' });

    expect(upOutput).toContain('🚀');
    expect(upOutput).toContain('Starting development environment');
    expect(upOutput).toContain('✅');
    expect(upOutput).toContain('https://app.lvh.me');
    expect(upOutput).toContain('https://proxy.lvh.me');

    // Step 3: Stop environment (down command) - requires Docker
    const downOutput = execSync(`${cli} down`, { encoding: 'utf-8' });

    expect(downOutput).toContain('🛑');
    expect(downOutput).toContain('Stopping development environment');
    expect(downOutput).toContain('✅');
  });

  it('should handle BaaS detection and proxy generation', () => {
    // Initialize project first
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Create mock Supabase configuration to trigger detection
    execSync('mkdir -p supabase');
    writeFileSync('supabase/config.toml', `
[api]
enabled = true
port = 54321

[studio]
enabled = true
port = 54323
`);

    // Create mock Dockerfile
    writeFileSync('Dockerfile', 'FROM node:20-alpine\nEXPOSE 3000');

    // Skip Docker-dependent tests if Docker is not available
    if (!isDockerAvailable()) {
      console.log('⚠️ Skipping BaaS Docker tests - Docker not available');
      return;
    }

    // Run up command
    const upOutput = execSync(`${cli} up`, { encoding: 'utf-8' });

    // Should detect Supabase and show additional URLs
    expect(upOutput).toContain('BaaS services detected');
    expect(upOutput).toContain('Supabase');
    expect(upOutput).toContain('https://api.lvh.me');
    expect(upOutput).toContain('https://db.lvh.me');
    expect(upOutput).toContain('https://storage.lvh.me');

    // Should create Traefik dynamic configuration
    expect(existsSync('.light/traefik/dynamic.yml')).toBe(true);

    const dynamicConfig = yaml.load(readFileSync('.light/traefik/dynamic.yml', 'utf-8')) as any;
    expect(dynamicConfig.http.routers['supabase-api']).toBeDefined();
    expect(dynamicConfig.http.routers['supabase-api'].rule).toBe('Host(`api.lvh.me`)');
    expect(dynamicConfig.http.services['supabase-api']).toBeDefined();
  });

  it('should handle environment variables correctly', () => {
    // Initialize project
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Create mock Dockerfile
    writeFileSync('Dockerfile', 'FROM node:20-alpine\nEXPOSE 3000');

    if (!isDockerAvailable()) {
      console.log('⚠️ Skipping environment variable Docker tests - Docker not available');
      return;
    }

    // Test without .env file (should show informational message)
    const upOutputNoEnv = execSync(`${cli} up`, { encoding: 'utf-8' });
    expect(upOutputNoEnv).toContain('No .env file found');
    expect(upOutputNoEnv).toContain('Using built-in defaults');

    // Create .env file
    writeFileSync('.env', `
PROJECT_NAME=test-project
APP_PORT=3000
DATABASE_URL=postgresql://localhost:5432/test
`);

    // Test with .env file (should not show the warning)
    const upOutputWithEnv = execSync(`${cli} up`, { encoding: 'utf-8' });
    expect(upOutputWithEnv).not.toContain('No .env file found');
  });

  it('should validate prerequisites properly', () => {
    // Initialize project
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Try to run up without Dockerfile (should fail with helpful error)
    let errorOutput = '';
    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
    }

    // Should fail and mention Dockerfile requirement
    expect(errorOutput).toContain('Dockerfile not found');
    expect(errorOutput).toContain('https://cli.lightstack.dev');
  });

  it('should handle project directory name correctly', () => {
    // Test init with explicit valid project name since temp directory names contain invalid chars
    const initOutput = execSync(`${cli} init valid-project-name`, { encoding: 'utf-8' });

    expect(initOutput).toContain('✅');
    expect(existsSync('light.config.yaml')).toBe(true);

    const config = yaml.load(readFileSync('light.config.yaml', 'utf-8')) as any;
    // Should use the explicit project name
    expect(config.name).toBe('valid-project-name');
  });

  it('should generate valid Docker Compose files', () => {
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Check base Docker Compose file
    const baseCompose = yaml.load(readFileSync('.light/docker-compose.yml', 'utf-8')) as any;
    expect(baseCompose.services).toBeDefined();
    expect(baseCompose.services.traefik).toBeDefined();
    expect(baseCompose.services.app).toBeDefined();
    expect(baseCompose.networks).toBeDefined();
    expect(baseCompose.networks.lightstack).toBeDefined();

    // Check development overrides
    const devCompose = yaml.load(readFileSync('.light/docker-compose.dev.yml', 'utf-8')) as any;
    expect(devCompose.services).toBeDefined();
    expect(devCompose.services.traefik).toBeDefined();
    expect(devCompose.services.traefik.volumes).toContain('./certs:/certs:ro');

    // Check production overrides
    const prodCompose = yaml.load(readFileSync('.light/docker-compose.prod.yml', 'utf-8')) as any;
    expect(prodCompose.services).toBeDefined();
    expect(prodCompose.services.traefik).toBeDefined();
  });
});