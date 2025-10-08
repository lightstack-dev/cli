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

    console.log(chalk.blue('ℹ'), 'Stopping router...');

    // Simple approach: Just use project name to stop all containers
    // Docker Compose doesn't need the exact compose files to stop containers
    const projectArg = `--project-name ${projectConfig.name}`;
    const volumesFlag = removeVolumes ? '-v' : '';
    const dockerCmd = `docker compose ${projectArg} down ${volumesFlag}`.trim();

    // Execute Docker Compose
    execSync(dockerCmd, { stdio: 'inherit' });

    console.log(chalk.green('✓'), 'Router stopped');

    if (removeVolumes) {
      console.log(chalk.yellow('!'), 'Volumes removed - data may be lost');
    }

  } catch (error) {
    console.error(chalk.red('✗'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}