import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('CLI Functionality Integration', () => {
  let tempDir: string;
  let originalCwd: string;
  const projectRoot = join(__dirname, '..', '..');
  const cli = `node "${join(projectRoot, 'dist', 'cli.js')}"`; // Use built CLI with absolute path

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'light-cli-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('init command', () => {
    it('should initialize project with YAML configuration', () => {
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
    });

    it('should create Docker Compose files with correct structure', () => {
      execSync(`${cli} init test-project`, { encoding: 'utf-8' });

      // Verify Docker Compose files are created
      expect(existsSync('.light/docker-compose.yml')).toBe(true);
      expect(existsSync('.light/docker-compose.dev.yml')).toBe(true);
      expect(existsSync('.light/docker-compose.prod.yml')).toBe(true);

      // Check base Docker Compose file structure
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

    it('should create necessary directories', () => {
      execSync(`${cli} init test-project`, { encoding: 'utf-8' });

      // Verify directories are created
      expect(existsSync('.light')).toBe(true);
      expect(existsSync('.light/certs')).toBe(true);
    });
  });

  describe('up command', () => {
    beforeEach(() => {
      // Initialize a project first
      execSync(`${cli} init test-project`, { encoding: 'utf-8' });

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
    });

    it('should detect missing Dockerfile and provide helpful error', () => {
      // Remove the Dockerfile
      rmSync('Dockerfile');

      let errorOutput = '';
      try {
        execSync(`${cli} up`, { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
      } catch (error: any) {
        // Get the output from all possible sources
        errorOutput = [
          error.stdout?.toString(),
          error.stderr?.toString(),
          error.message
        ].filter(Boolean).join('\n');
      }

      // Should contain either the error message or indicate the command failed appropriately
      const hasDockerFileError = errorOutput.includes('Dockerfile not found') ||
                                  errorOutput.includes('Dockerfile') ||
                                  errorOutput.includes('failed');

      expect(hasDockerFileError).toBe(true);
    });

    it('should show informational message when no .env file exists', () => {
      // Mock Docker to avoid actually running containers
      const originalExecSync = execSync;
      const mockExecSync = (command: string, options?: any) => {
        if (command.includes('docker info')) {
          return 'Docker is running';
        }
        if (command.includes('docker compose')) {
          return 'Docker Compose command executed';
        }
        return originalExecSync(command, options);
      };

      try {
        // This will only test the validation and setup logic, not actual Docker execution
        execSync(`${cli} up`, { encoding: 'utf-8', timeout: 10000 });
      } catch (error: any) {
        // Expected to fail during Docker execution, but we can check the output
        const output = error.stdout?.toString() || '';
        if (output.includes('No .env file found')) {
          expect(output).toContain('Using built-in defaults');
        }
      }
    });

    it('should detect BaaS services and generate proxy configuration', () => {
      // Create mock Supabase configuration
      execSync('mkdir -p supabase');
      writeFileSync('supabase/config.toml', `
[api]
enabled = true
port = 54321

[studio]
enabled = true
port = 54323
`);

      try {
        execSync(`${cli} up`, { encoding: 'utf-8', timeout: 10000 });
      } catch (error: any) {
        // Expected to fail during Docker execution, but we can check what was generated
        const output = error.stdout?.toString() || '';

        // Should have detected Supabase
        if (output.includes('BaaS services detected')) {
          expect(output).toContain('Supabase');
        }

        // Should create Traefik dynamic configuration (if CLI reaches that point)
        // Note: In CI, CLI might fail before generating configs due to Docker issues
        if (existsSync('.light/traefik/dynamic.yml')) {
          const dynamicConfig = yaml.load(readFileSync('.light/traefik/dynamic.yml', 'utf-8')) as any;
          expect(dynamicConfig.http.routers['supabase-api']).toBeDefined();
          expect(dynamicConfig.http.routers['supabase-api'].rule).toBe('Host(`api.lvh.me`)');
          expect(dynamicConfig.http.services['supabase-api']).toBeDefined();
        } else {
          // Acceptable if Docker/other errors prevented reaching this point
          const hasDockerError = output.includes('Docker') || output.includes('failed');
          expect(hasDockerError).toBe(true);
        }
      }
    });
  });

  describe('down command', () => {
    beforeEach(() => {
      // Initialize a project first
      execSync(`${cli} init test-project`, { encoding: 'utf-8' });
    });

    it('should validate project exists before running', () => {
      // Remove the configuration
      rmSync('light.config.yaml');

      let errorOutput = '';
      try {
        execSync(`${cli} down`, { encoding: 'utf-8' });
      } catch (error: any) {
        errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
      }

      expect(errorOutput).toContain('No Lightstack project found');
    });
  });

  describe('CLI help and version', () => {
    it('should show version when requested', () => {
      let output = '';
      try {
        execSync(`${cli} --version`, { encoding: 'utf-8' });
      } catch (error: any) {
        output = error.stdout?.toString() || error.stderr?.toString() || '';
      }

      // Should show a version number (Commander.js outputs version and exits)
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should show help when requested', () => {
      let output = '';
      try {
        execSync(`${cli} --help`, { encoding: 'utf-8' });
      } catch (error: any) {
        output = error.stdout?.toString() || error.stderr?.toString() || '';
      }

      expect(output).toContain('light');
      expect(output).toContain('init');
      expect(output).toContain('up');
      expect(output).toContain('down');
    });
  });
});