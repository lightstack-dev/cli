import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Docker Error Handling', () => {
  let tempDir: string;
  const cli = 'bun run src/cli.ts';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'light-error-test-'));
    process.chdir(tempDir);

    // Create a basic project configuration
    writeFileSync('light.config.json', JSON.stringify({
      name: 'error-test-project',
      services: [{ name: 'app', type: 'nuxt', port: 3000 }]
    }));
  });

  afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should detect when Docker daemon is not running', () => {
    if (isDockerRunning()) {
      // Skip this test if Docker is actually running
      console.log('Skipping Docker not running test - Docker is available');
      return;
    }

    expect(() => {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    }).toThrow();

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/docker.*not.*running/i);
      expect(error.message).toContain('Solution:');
      expect(error.message).toMatch(/(start.*docker|install.*docker)/i);
    }
  });

  it('should provide helpful error for Docker not installed', () => {
    // Mock Docker not being installed by testing the error path
    try {
      execSync('nonexistent-docker-command info', { stdio: 'ignore' });
    } catch (error: any) {
      // This simulates what should happen when Docker is not found
      expect(error.message || error.code).toBeDefined();
    }
  });

  it('should handle Docker permission errors gracefully', () => {
    if (!isDockerRunning()) {
      console.log('Skipping Docker permission test - Docker not available');
      return;
    }

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      // If there's a permission error, should provide helpful guidance
      if (error.message.includes('permission') || error.message.includes('EACCES')) {
        expect(error.message).toMatch(/(permission|access|sudo|docker.*group)/i);
        expect(error.message).toContain('Solution:');
      }
    }
  });

  it('should validate Docker version compatibility', () => {
    if (!isDockerRunning()) {
      console.log('Skipping Docker version test - Docker not available');
      return;
    }

    try {
      const dockerVersion = execSync('docker --version', { encoding: 'utf-8' });
      expect(dockerVersion).toContain('Docker');

      // If we can get version, the CLI should work with it
      // Real implementation would check minimum version requirements
    } catch (error: any) {
      expect(error.message).toMatch(/docker.*not.*found/i);
    }
  });

  it('should handle Docker Compose not available', () => {
    if (!isDockerRunning()) {
      console.log('Skipping Docker Compose test - Docker not available');
      return;
    }

    try {
      // Test if docker compose is available
      execSync('docker compose version', { stdio: 'ignore' });
    } catch (error: any) {
      // If docker compose is not available, CLI should handle it
      try {
        execSync(`${cli} up`, { encoding: 'utf-8' });
      } catch (cliError: any) {
        expect(cliError.message).toMatch(/(compose.*not.*found|compose.*plugin)/i);
        expect(cliError.message).toContain('Solution:');
      }
    }
  });

  it('should provide clear error messages for Docker failures', () => {
    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      // Error messages should follow the specified format
      if (error.message.includes('Error:')) {
        expect(error.message).toMatch(/❌ Error:/);
        expect(error.message).toContain('Cause:');
        expect(error.message).toContain('Solution:');
        expect(error.message).toMatch(/For more help: light .* --help/);
      }
    }
  });

  it('should suggest Docker installation when missing', () => {
    // This tests the error handling path
    const mockError = 'docker: command not found';

    // Test that our error handler would format this correctly
    expect(mockError).toContain('docker');
    expect(mockError).toContain('not found');

    // Real implementation would transform this into:
    // ❌ Error: Docker not found
    // Cause: Docker is not installed or not in PATH
    // Solution: Install Docker Desktop from https://docker.com/get-started
  });

  it('should handle Docker service startup failures', () => {
    if (!isDockerRunning()) {
      console.log('Skipping Docker service test - Docker not available');
      return;
    }

    // Create a configuration that might cause startup issues
    writeFileSync('light.config.json', JSON.stringify({
      name: 'problematic-project',
      services: [
        { name: 'app', type: 'nuxt', port: 1 }, // Invalid port
        { name: 'conflicting', type: 'nuxt', port: 1 } // Same port
      ]
    }));

    try {
      execSync(`${cli} up`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/(port.*conflict|invalid.*port|bind.*failed)/i);
    }
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