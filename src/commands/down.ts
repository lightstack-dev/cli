import { existsSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { getProjectConfig } from '../utils/config.js';

interface DownOptions {
  volumes?: boolean;
}

export function downCommand(options: DownOptions = {}) {
  try {
    const removeVolumes = options.volumes || false;

    // Check if project is initialized
    if (!existsSync('light.config.yml') && !existsSync('light.config.yml')) {
      throw new Error('No Lightstack project found.');
    }

    // Check if Docker Compose files exist
    if (!existsSync('.light/docker-compose.yml')) {
      throw new Error('Docker Compose files not found.');
    }

    const projectConfig = getProjectConfig();

    console.log(chalk.blue('🛑'), 'Stopping local proxy...');

    // Build Docker Compose command with project name
    const projectArg = `--project-name ${projectConfig.name}`;
    const envFileArg = existsSync('.env') ? '--env-file ./.env' : '';
    const volumesFlag = removeVolumes ? '-v' : '';
    const dockerCmd = `docker compose ${projectArg} -f .light/docker-compose.yml -f .light/docker-compose.dev.yml ${envFileArg} down ${volumesFlag}`.trim();

    // Execute Docker Compose
    execSync(dockerCmd, { stdio: 'inherit' });

    console.log(chalk.green('✅'), 'Local proxy stopped');

    if (removeVolumes) {
      console.log(chalk.yellow('⚠️'), 'Volumes removed - data may be lost');
    }

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}