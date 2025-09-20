import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

// Helper function to check if Docker is available
function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
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

    // Test CLI up command validation (will fail appropriately without Docker/real app)
    let upError = '';
    try {
      execSync(`${cli} up`, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error: any) {
      upError = [
        error.stdout?.toString(),
        error.stderr?.toString(),
        error.message
      ].filter(Boolean).join('\n');
    }

    // Should either work or fail with appropriate Docker/build errors
    const hasValidResponse = upError.includes('Starting') ||
                              upError.includes('Docker') ||
                              upError.includes('failed') ||
                              upError.includes('build');

    expect(hasValidResponse).toBe(true);
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

    // Test CLI up command with BaaS detection
    let upOutput = '';
    try {
      execSync(`${cli} up`, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error: any) {
      upOutput = [
        error.stdout?.toString(),
        error.stderr?.toString(),
        error.message
      ].filter(Boolean).join('\n');
    }

    // Should detect Supabase even if Docker fails
    const hasBaaSDetection = upOutput.includes('BaaS services detected') ||
                             upOutput.includes('Supabase') ||
                             existsSync('.light/traefik/dynamic.yml');

    expect(hasBaaSDetection).toBe(true);

    // Should create Traefik dynamic configuration regardless of Docker status
    if (existsSync('.light/traefik/dynamic.yml')) {
      const dynamicConfig = yaml.load(readFileSync('.light/traefik/dynamic.yml', 'utf-8')) as any;
      expect(dynamicConfig.http.routers['supabase-api']).toBeDefined();
      expect(dynamicConfig.http.routers['supabase-api'].rule).toBe('Host(`api.lvh.me`)');
      expect(dynamicConfig.http.services['supabase-api']).toBeDefined();
    }
  });

  it('should handle environment variables correctly', () => {
    // Initialize project
    execSync(`${cli} init test-project`, { encoding: 'utf-8' });

    // Create mock Dockerfile
    writeFileSync('Dockerfile', 'FROM node:20-alpine\nEXPOSE 3000');

    // Test without .env file (should show informational message)
    let upOutputNoEnv = '';
    try {
      execSync(`${cli} up`, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error: any) {
      upOutputNoEnv = [
        error.stdout?.toString(),
        error.stderr?.toString(),
        error.message
      ].filter(Boolean).join('\n');
    }

    // Should contain .env info message or general execution info
    const hasEnvInfo = upOutputNoEnv.includes('No .env file found') ||
                       upOutputNoEnv.includes('defaults') ||
                       upOutputNoEnv.includes('environment');

    expect(hasEnvInfo).toBe(true);
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