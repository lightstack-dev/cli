import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateDockerfile, type DockerfileConfig } from '../../src/utils/dockerfile.js';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('Dockerfile Utilities', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'dockerfile-test');
  const packageJsonPath = join(testDir, 'package.json');

  beforeEach(() => {
    // Create test directory
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(packageJsonPath)) {
        unlinkSync(packageJsonPath);
      }
      rmdirSync(testDir);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('generateDockerfile - Validation', () => {
    it('should throw error when package.json is missing', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        expect(() => generateDockerfile()).toThrow('No package.json found in the current directory');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should throw error when build script is missing', () => {
      const originalCwd = process.cwd();

      try {
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'test-app',
          scripts: {
            start: 'node index.js'
          }
        }));

        process.chdir(testDir);

        expect(() => generateDockerfile()).toThrow(
          'Your package.json is missing required scripts. Add: "scripts": { "build": "..." }'
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should throw error when start script is missing', () => {
      const originalCwd = process.cwd();

      try {
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'test-app',
          scripts: {
            build: 'webpack'
          }
        }));

        process.chdir(testDir);

        expect(() => generateDockerfile()).toThrow(
          'Your package.json is missing required scripts. Add: "scripts": { "start": "..." }'
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should throw error for custom build command when missing', () => {
      const originalCwd = process.cwd();

      try {
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'test-app',
          scripts: {
            build: 'webpack',
            start: 'node index.js'
          }
        }));

        process.chdir(testDir);

        expect(() => generateDockerfile({ buildCommand: 'custom-build' })).toThrow(
          'Your package.json is missing required scripts. Add: "scripts": { "custom-build": "..." }'
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate successfully with required scripts present', () => {
      const originalCwd = process.cwd();

      try {
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'test-app',
          scripts: {
            build: 'webpack',
            start: 'node index.js'
          }
        }));

        process.chdir(testDir);

        const dockerfile = generateDockerfile();
        expect(dockerfile).toContain('FROM node:');
        expect(dockerfile).toContain('Multi-stage Dockerfile');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('generateDockerfile - Package Managers', () => {
    beforeEach(() => {
      writeFileSync(packageJsonPath, JSON.stringify({
        name: 'test-app',
        scripts: {
          build: 'webpack',
          start: 'node index.js'
        }
      }));
    });

    it('should generate Dockerfile with npm by default', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('package-lock.json');
        expect(dockerfile).toContain('npm ci');
        expect(dockerfile).toContain('npm ci --only=production');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate Dockerfile with yarn', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ packageManager: 'yarn' });

        expect(dockerfile).toContain('yarn.lock');
        expect(dockerfile).toContain('yarn install --frozen-lockfile');
        expect(dockerfile).toContain('yarn install --frozen-lockfile --production');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate Dockerfile with pnpm', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ packageManager: 'pnpm' });

        expect(dockerfile).toContain('pnpm-lock.yaml');
        expect(dockerfile).toContain('pnpm install --frozen-lockfile');
        expect(dockerfile).toContain('pnpm install --frozen-lockfile --prod');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate Dockerfile with bun', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ packageManager: 'bun' });

        expect(dockerfile).toContain('bun.lockb');
        expect(dockerfile).toContain('bun install --frozen-lockfile');
        expect(dockerfile).toContain('bun install --frozen-lockfile --production');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('generateDockerfile - Configuration Options', () => {
    beforeEach(() => {
      writeFileSync(packageJsonPath, JSON.stringify({
        name: 'test-app',
        scripts: {
          build: 'webpack',
          start: 'node index.js',
          'custom-build': 'rollup',
          'custom-start': 'node server.js'
        }
      }));
    });

    it('should use custom node version', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ nodeVersion: '18-alpine' });

        expect(dockerfile).toContain('FROM node:18-alpine');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use default node version 20-alpine', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('FROM node:20-alpine');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use custom build command', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ buildCommand: 'custom-build' });

        expect(dockerfile).toContain('RUN npm run custom-build');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use custom start command', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ startCommand: 'custom-start' });

        expect(dockerfile).toContain('CMD ["npm", "run custom-start"]');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use custom port', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ appPort: 8080 });

        expect(dockerfile).toContain('EXPOSE 8080');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use default port 3000', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('EXPOSE 3000');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('generateDockerfile - Next.js Support', () => {
    beforeEach(() => {
      writeFileSync(packageJsonPath, JSON.stringify({
        name: 'test-app',
        scripts: {
          build: 'next build',
          start: 'next start'
        }
      }));
    });

    it('should generate standard Dockerfile when hasNext is false', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ hasNext: false });

        expect(dockerfile).not.toContain('.next/standalone');
        expect(dockerfile).not.toContain('.next/static');
        expect(dockerfile).not.toContain('server.js');
        expect(dockerfile).toContain('COPY --from=builder --chown=nodejs:nodejs /app ./');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate Next.js optimized Dockerfile when hasNext is true', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile({ hasNext: true });

        expect(dockerfile).toContain('COPY --from=builder --chown=nodejs:nodejs /app/public ./public');
        expect(dockerfile).toContain('COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./');
        expect(dockerfile).toContain('COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static');
        expect(dockerfile).toContain('CMD ["node", "server.js"]');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('generateDockerfile - Multi-stage Structure', () => {
    beforeEach(() => {
      writeFileSync(packageJsonPath, JSON.stringify({
        name: 'test-app',
        scripts: {
          build: 'webpack',
          start: 'node index.js'
        }
      }));
    });

    it('should contain all three build stages', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('FROM node:20-alpine AS deps');
        expect(dockerfile).toContain('FROM node:20-alpine AS builder');
        expect(dockerfile).toContain('FROM node:20-alpine AS runner');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should have correct stage order', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        const depsIndex = dockerfile.indexOf('AS deps');
        const builderIndex = dockerfile.indexOf('AS builder');
        const runnerIndex = dockerfile.indexOf('AS runner');

        expect(depsIndex).toBeLessThan(builderIndex);
        expect(builderIndex).toBeLessThan(runnerIndex);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should copy from previous stages correctly', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('COPY --from=deps');
        expect(dockerfile).toContain('COPY --from=builder');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should set production environment', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('ENV NODE_ENV=production');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should create and use non-root user', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('addgroup -g 1001 -S nodejs');
        expect(dockerfile).toContain('adduser -S nodejs -u 1001');
        expect(dockerfile).toContain('USER nodejs');
        expect(dockerfile).toContain('--chown=nodejs:nodejs');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should have WORKDIR set in all stages', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        const workdirCount = (dockerfile.match(/WORKDIR \/app/g) || []).length;
        expect(workdirCount).toBe(3); // One for each stage
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('generateDockerfile - Content Verification', () => {
    beforeEach(() => {
      writeFileSync(packageJsonPath, JSON.stringify({
        name: 'test-app',
        scripts: {
          build: 'webpack',
          start: 'node index.js'
        }
      }));
    });

    it('should include Lightstack CLI comment', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        expect(dockerfile).toContain('Generated by Lightstack CLI');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should be a valid Dockerfile format', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        // Check for essential Dockerfile instructions
        expect(dockerfile).toMatch(/FROM node:/);
        expect(dockerfile).toMatch(/WORKDIR/);
        expect(dockerfile).toMatch(/COPY/);
        expect(dockerfile).toMatch(/RUN/);
        expect(dockerfile).toMatch(/EXPOSE/);
        expect(dockerfile).toMatch(/CMD/);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should copy package files in deps stage', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        // Find deps stage
        const depsStage = dockerfile.substring(
          dockerfile.indexOf('AS deps'),
          dockerfile.indexOf('AS builder')
        );

        expect(depsStage).toContain('COPY package.json');
        expect(depsStage).toContain('package-lock.json');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should copy source code in builder stage', () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);
        const dockerfile = generateDockerfile();

        // Find builder stage
        const builderStage = dockerfile.substring(
          dockerfile.indexOf('AS builder'),
          dockerfile.indexOf('AS runner')
        );

        expect(builderStage).toContain('COPY . .');
        expect(builderStage).toContain('RUN npm run build');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
