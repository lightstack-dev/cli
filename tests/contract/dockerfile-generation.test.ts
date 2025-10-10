import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateDockerfile, type DockerfileConfig } from '../../src/utils/dockerfile.js';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('Dockerfile Generation Contract Tests', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'dockerfile-contract');
  const packageJsonPath = join(testDir, 'package.json');
  const dockerfilePath = join(testDir, 'Dockerfile');

  beforeEach(() => {
    // Create test directory
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Create a valid package.json
    writeFileSync(packageJsonPath, JSON.stringify({
      name: 'test-app',
      version: '1.0.0',
      scripts: {
        build: 'webpack',
        start: 'node index.js'
      }
    }, null, 2));
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(dockerfilePath)) {
        unlinkSync(dockerfilePath);
      }
      if (existsSync(packageJsonPath)) {
        unlinkSync(packageJsonPath);
      }
      rmdirSync(testDir);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('File Creation', () => {
    it('should generate Dockerfile content that can be written to disk', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfileContent = generateDockerfile();

        // Write to file
        writeFileSync(dockerfilePath, dockerfileContent);

        // Verify file exists
        expect(existsSync(dockerfilePath)).toBe(true);

        // Verify file is readable
        const readContent = readFileSync(dockerfilePath, 'utf-8');
        expect(readContent).toBe(dockerfileContent);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate valid multi-line content', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfileContent = generateDockerfile();

        writeFileSync(dockerfilePath, dockerfileContent);
        const content = readFileSync(dockerfilePath, 'utf-8');
        const lines = content.split('\n');

        // Should have multiple lines (multi-stage build)
        expect(lines.length).toBeGreaterThan(50);

        // File should be valid UTF-8 and contain expected content
        expect(content).toContain('FROM node:');
        expect(content).toContain('WORKDIR');
        expect(content).toContain('COPY');
        expect(content).toContain('RUN');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Generated Content Structure', () => {
    it('should generate Dockerfile with all required stages', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfileContent = generateDockerfile();

        writeFileSync(dockerfilePath, dockerfileContent);
        const content = readFileSync(dockerfilePath, 'utf-8');

        // Verify all three stages exist
        expect(content).toMatch(/FROM node:.*AS deps/);
        expect(content).toMatch(/FROM node:.*AS builder/);
        expect(content).toMatch(/FROM node:.*AS runner/);

        // Verify stage separation
        const stages = content.match(/FROM node:/g);
        expect(stages).toHaveLength(3);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate Dockerfile with proper instruction ordering', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfileContent = generateDockerfile();

        writeFileSync(dockerfilePath, dockerfileContent);
        const content = readFileSync(dockerfilePath, 'utf-8');

        // Check critical instruction order
        const fromIndex = content.indexOf('FROM');
        const workdirIndex = content.indexOf('WORKDIR');
        const copyIndex = content.indexOf('COPY');
        const runIndex = content.indexOf('RUN');
        const exposeIndex = content.indexOf('EXPOSE');
        const cmdIndex = content.indexOf('CMD');

        expect(fromIndex).toBeLessThan(workdirIndex);
        expect(workdirIndex).toBeLessThan(copyIndex);
        expect(copyIndex).toBeLessThan(runIndex);
        expect(runIndex).toBeLessThan(exposeIndex);
        expect(exposeIndex).toBeLessThan(cmdIndex);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate Dockerfile with security best practices', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfileContent = generateDockerfile();

        writeFileSync(dockerfilePath, dockerfileContent);
        const content = readFileSync(dockerfilePath, 'utf-8');

        // Non-root user
        expect(content).toContain('addgroup');
        expect(content).toContain('adduser');
        expect(content).toContain('USER nodejs');

        // File ownership
        expect(content).toContain('--chown=nodejs:nodejs');

        // Production environment
        expect(content).toContain('NODE_ENV=production');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Package Manager Variations', () => {
    const packageManagers: Array<{ manager: 'npm' | 'yarn' | 'pnpm' | 'bun', lockFile: string }> = [
      { manager: 'npm', lockFile: 'package-lock.json' },
      { manager: 'yarn', lockFile: 'yarn.lock' },
      { manager: 'pnpm', lockFile: 'pnpm-lock.yaml' },
      { manager: 'bun', lockFile: 'bun.lockb' }
    ];

    packageManagers.forEach(({ manager, lockFile }) => {
      it(`should generate valid Dockerfile for ${manager}`, () => {
        const originalCwd = process.cwd();

        try {
          process.chdir(testDir);
          const dockerfileContent = generateDockerfile({ packageManager: manager });

          writeFileSync(dockerfilePath, dockerfileContent);
          const content = readFileSync(dockerfilePath, 'utf-8');

          // Verify package manager specific content
          expect(content).toContain(lockFile);

          // Should have consistent package manager usage
          const managerMentions = (content.match(new RegExp(manager, 'g')) || []).length;
          expect(managerMentions).toBeGreaterThan(0);
        } finally {
          process.chdir(originalCwd);
        }
      });
    });
  });

  describe('Configuration Options Integration', () => {
    it('should generate Dockerfile with custom configuration', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        const config: DockerfileConfig = {
          nodeVersion: '18-alpine',
          packageManager: 'yarn',
          buildCommand: 'build',
          startCommand: 'start',
          appPort: 8080,
          hasNext: false
        };

        const dockerfileContent = generateDockerfile(config);

        writeFileSync(dockerfilePath, dockerfileContent);
        const content = readFileSync(dockerfilePath, 'utf-8');

        // Verify all custom options are applied
        expect(content).toContain('node:18-alpine');
        expect(content).toContain('yarn.lock');
        expect(content).toContain('EXPOSE 8080');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate Next.js optimized Dockerfile when configured', () => {
      const originalCwd = process.cwd();

      try {
        // Update package.json with Next.js scripts
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'test-next-app',
          version: '1.0.0',
          scripts: {
            build: 'next build',
            start: 'next start'
          }
        }, null, 2));

        process.chdir(testDir);

        const dockerfileContent = generateDockerfile({ hasNext: true });

        writeFileSync(dockerfilePath, dockerfileContent);
        const content = readFileSync(dockerfilePath, 'utf-8');

        // Verify Next.js specific optimizations
        expect(content).toContain('.next/standalone');
        expect(content).toContain('.next/static');
        expect(content).toContain('server.js');
        expect(content).toContain('public');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should generate production-ready Dockerfile', () => {
      const originalCwd = process.cwd();

      try {
        // Realistic package.json
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'my-production-app',
          version: '1.0.0',
          description: 'A production web application',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            start: 'node dist/server.js',
            test: 'vitest'
          },
          dependencies: {
            express: '^4.18.0',
            react: '^18.2.0'
          },
          devDependencies: {
            vite: '^4.0.0',
            typescript: '^5.0.0'
          }
        }, null, 2));

        process.chdir(testDir);

        const dockerfileContent = generateDockerfile({
          nodeVersion: '20-alpine',
          packageManager: 'npm',
          appPort: 3000
        });

        writeFileSync(dockerfilePath, dockerfileContent);

        // Verify file was created successfully
        expect(existsSync(dockerfilePath)).toBe(true);

        const content = readFileSync(dockerfilePath, 'utf-8');

        // Verify production-ready features
        expect(content).toContain('Multi-stage Dockerfile');
        expect(content).toContain('NODE_ENV=production');
        expect(content).toContain('npm ci --only=production');
        expect(content).toContain('USER nodejs');

        // Verify proper size (should be substantial multi-stage build)
        expect(content.length).toBeGreaterThan(1000);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle edge case with minimal package.json', () => {
      const originalCwd = process.cwd();

      try {
        // Minimal but valid package.json
        writeFileSync(packageJsonPath, JSON.stringify({
          scripts: {
            build: 'echo "Building..."',
            start: 'echo "Starting..."'
          }
        }));

        process.chdir(testDir);

        const dockerfileContent = generateDockerfile();

        writeFileSync(dockerfilePath, dockerfileContent);
        const content = readFileSync(dockerfilePath, 'utf-8');

        // Should still generate valid Dockerfile
        expect(content).toContain('FROM node:');
        expect(content).toContain('WORKDIR');
        expect(content).toContain('CMD');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Error Recovery', () => {
    it('should fail gracefully when package.json is invalid JSON', () => {
      const originalCwd = process.cwd();

      try {
        // Write invalid JSON
        writeFileSync(packageJsonPath, '{ invalid json }');

        process.chdir(testDir);

        expect(() => generateDockerfile()).toThrow();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should fail gracefully when scripts field is missing', () => {
      const originalCwd = process.cwd();

      try {
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'test-app'
          // No scripts field
        }));

        process.chdir(testDir);

        expect(() => generateDockerfile()).toThrow('missing required scripts');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
