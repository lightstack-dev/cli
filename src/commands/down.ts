import { existsSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

interface DownOptions {
  volumes?: boolean;
}

export function downCommand(options: DownOptions = {}) {
  try {
    const removeVolumes = options.volumes || false;

    // Check if project is initialized
    if (!existsSync('light.config.yaml') && !existsSync('light.config.yml')) {
      throw new Error('No Lightstack project found.');
    }

    // Check if Docker Compose files exist
    if (!existsSync('.light/docker-compose.yml')) {
      throw new Error('Docker Compose files not found.');
    }

    console.log(chalk.blue('🛑'), 'Stopping development environment...');

    // Build Docker Compose command
    const envFileArg = existsSync('.env') ? '--env-file ./.env' : '';
    const volumesFlag = removeVolumes ? '-v' : '';
    const dockerCmd = `docker compose -f .light/docker-compose.yml -f .light/docker-compose.dev.yml ${envFileArg} down ${volumesFlag}`.trim();

    // Execute Docker Compose
    execSync(dockerCmd, { stdio: 'inherit' });

    console.log(chalk.green('✓'), 'Development environment stopped');

    if (removeVolumes) {
      console.log(chalk.yellow('⚠️'), 'Volumes removed - data may be lost');
    }

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}