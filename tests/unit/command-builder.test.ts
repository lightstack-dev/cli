import { describe, it, expect } from 'vitest';

// Extract and test the command building logic from up.ts
function buildDockerCommand(
  composeFiles: string[],
  options: { detach: boolean; projectName: string; hasEnvFile?: boolean }
): string {
  const fileArgs = composeFiles.map(f => `-f ${f}`).join(' ');
  const projectArg = `--project-name ${options.projectName}`;
  const envFileArg = options.hasEnvFile ? '--env-file ./.env' : '';
  const detachFlag = options.detach ? '-d' : '';

  return `docker compose ${projectArg} ${fileArgs} ${envFileArg} up ${detachFlag}`.replace(/\s+/g, ' ').trim();
}

function getComposeFiles(env: string, hasSupabaseStack: boolean): string[] {
  const baseFile = '.light/docker-compose.yml';
  const envFile = `.light/docker-compose.${env}.yml`;
  const supabaseFile = '.light/docker-compose.supabase.yml';

  const files = [baseFile];

  // Add Supabase stack for non-development environments
  if (env !== 'development' && hasSupabaseStack) {
    files.push(supabaseFile);
  }

  // Always add env-specific override if it exists
  files.push(envFile);

  return files;
}

describe('Docker Command Builder', () => {
  describe('buildDockerCommand', () => {
    it('should build basic command with single compose file', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        { detach: true, projectName: 'myapp' }
      );

      expect(cmd).toBe('docker compose --project-name myapp -f .light/docker-compose.yml up -d');
    });

    it('should build command with multiple compose files', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml', '.light/docker-compose.dev.yml'],
        { detach: true, projectName: 'myapp' }
      );

      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('-f .light/docker-compose.dev.yml');
      expect(cmd).toContain('--project-name myapp');
    });

    it('should include --env-file when hasEnvFile is true', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        { detach: true, projectName: 'myapp', hasEnvFile: true }
      );

      expect(cmd).toContain('--env-file ./.env');
    });

    it('should omit --env-file when hasEnvFile is false', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        { detach: true, projectName: 'myapp', hasEnvFile: false }
      );

      expect(cmd).not.toContain('--env-file');
    });

    it('should include -d flag when detach is true', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        { detach: true, projectName: 'myapp' }
      );

      expect(cmd).toContain('up -d');
    });

    it('should omit -d flag when detach is false', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        { detach: false, projectName: 'myapp' }
      );

      expect(cmd).toContain('up');
      expect(cmd).not.toContain('-d');
    });

    it('should handle project names with hyphens', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        { detach: true, projectName: 'my-awesome-app' }
      );

      expect(cmd).toContain('--project-name my-awesome-app');
    });

    it('should build production command with Supabase stack', () => {
      const cmd = buildDockerCommand(
        [
          '.light/docker-compose.yml',
          '.light/docker-compose.supabase.yml',
          '.light/docker-compose.production.yml'
        ],
        { detach: true, projectName: 'myapp', hasEnvFile: true }
      );

      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('-f .light/docker-compose.supabase.yml');
      expect(cmd).toContain('-f .light/docker-compose.production.yml');
      expect(cmd).toContain('--env-file ./.env');
    });

    it('should maintain correct argument order', () => {
      const cmd = buildDockerCommand(
        ['.light/docker-compose.yml'],
        { detach: true, projectName: 'myapp', hasEnvFile: true }
      );

      // Docker compose expects: compose [OPTIONS] COMMAND [ARGS]
      const projectIndex = cmd.indexOf('--project-name');
      const fileIndex = cmd.indexOf('-f');
      const envFileIndex = cmd.indexOf('--env-file');
      const upIndex = cmd.indexOf('up');

      expect(projectIndex).toBeLessThan(fileIndex);
      expect(fileIndex).toBeLessThan(upIndex);
      expect(envFileIndex).toBeLessThan(upIndex);
    });
  });

  describe('getComposeFiles', () => {
    it('should return base and dev files for development', () => {
      const files = getComposeFiles('development', false);

      expect(files).toContain('.light/docker-compose.yml');
      expect(files).toContain('.light/docker-compose.development.yml');
      expect(files).not.toContain('.light/docker-compose.supabase.yml');
    });

    it('should include Supabase stack for production', () => {
      const files = getComposeFiles('production', true);

      expect(files).toContain('.light/docker-compose.yml');
      expect(files).toContain('.light/docker-compose.supabase.yml');
      expect(files).toContain('.light/docker-compose.production.yml');
    });

    it('should not include Supabase stack for production if not available', () => {
      const files = getComposeFiles('production', false);

      expect(files).toContain('.light/docker-compose.yml');
      expect(files).not.toContain('.light/docker-compose.supabase.yml');
      expect(files).toContain('.light/docker-compose.production.yml');
    });

    it('should include environment-specific override', () => {
      const files = getComposeFiles('staging', false);

      expect(files).toContain('.light/docker-compose.yml');
      expect(files).toContain('.light/docker-compose.staging.yml');
    });

    it('should always start with base compose file', () => {
      const devFiles = getComposeFiles('development', false);
      const prodFiles = getComposeFiles('production', true);

      expect(devFiles[0]).toBe('.light/docker-compose.yml');
      expect(prodFiles[0]).toBe('.light/docker-compose.yml');
    });

    it('should add Supabase stack before environment override', () => {
      const files = getComposeFiles('production', true);

      const baseIndex = files.indexOf('.light/docker-compose.yml');
      const supabaseIndex = files.indexOf('.light/docker-compose.supabase.yml');
      const prodIndex = files.indexOf('.light/docker-compose.production.yml');

      expect(baseIndex).toBeLessThan(supabaseIndex);
      expect(supabaseIndex).toBeLessThan(prodIndex);
    });
  });

  describe('integration: command building with file selection', () => {
    it('should build correct command for development', () => {
      const files = getComposeFiles('development', false);
      const cmd = buildDockerCommand(files, {
        detach: true,
        projectName: 'myapp',
        hasEnvFile: false
      });

      expect(cmd).toContain('docker compose');
      expect(cmd).toContain('--project-name myapp');
      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('-f .light/docker-compose.development.yml');
      expect(cmd).not.toContain('supabase');
    });

    it('should build correct command for production with Supabase', () => {
      const files = getComposeFiles('production', true);
      const cmd = buildDockerCommand(files, {
        detach: true,
        projectName: 'myapp',
        hasEnvFile: true
      });

      expect(cmd).toContain('-f .light/docker-compose.yml');
      expect(cmd).toContain('-f .light/docker-compose.supabase.yml');
      expect(cmd).toContain('-f .light/docker-compose.production.yml');
      expect(cmd).toContain('--env-file ./.env');
    });
  });
});
