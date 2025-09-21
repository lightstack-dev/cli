import { existsSync } from 'fs';
import { execSync, spawn } from 'child_process';
import chalk from 'chalk';

interface LogsOptions {
  follow?: boolean;
  tail?: string;
}

export function logsCommand(service: string | undefined, options: LogsOptions = {}) {
  try {
    const follow = options.follow || false;
    const tail = options.tail || '50';

    // Check if project is initialized
    if (!existsSync('light.config.yaml') && !existsSync('light.config.yml')) {
      throw new Error('No Lightstack project found. Run "light init" first.');
    }

    // Check if Docker is running
    try {
      execSync('docker info', { stdio: 'ignore' });
    } catch {
      throw new Error('Docker is not running. Please start Docker Desktop and try again.');
    }

    // Check if Docker Compose files exist
    if (!existsSync('.light/docker-compose.yml')) {
      throw new Error('Docker Compose files not found. Run "light init" to regenerate them.');
    }

    // Build Docker Compose command
    const envFileArg = existsSync('.env') ? '--env-file ./.env' : '';
    const serviceArg = service || '';
    const followFlag = follow ? '-f' : '';
    const tailFlag = `--tail ${tail}`;

    const dockerCmd = `docker compose -f .light/docker-compose.yml -f .light/docker-compose.dev.yml ${envFileArg} logs ${followFlag} ${tailFlag} ${serviceArg}`.trim();

    console.log(chalk.blue('📋'), `Showing logs${service ? ` for ${service}` : ' for all services'}...`);
    if (follow) {
      console.log(chalk.gray('(Press Ctrl+C to stop following logs)'));
    }
    console.log('─'.repeat(60));

    if (follow) {
      // For follow mode, use spawn to handle real-time output
      const child = spawn('sh', ['-c', dockerCmd], {
        stdio: 'inherit',
        shell: true
      });

      // Handle graceful exit
      process.on('SIGINT', () => {
        child.kill('SIGINT');
        console.log('\n' + chalk.yellow('⚠️'), 'Stopped following logs');
        process.exit(0);
      });

      child.on('error', (error) => {
        throw error;
      });

      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          throw new Error(`Command exited with code ${code}`);
        }
      });
    } else {
      // For non-follow mode, use execSync
      try {
        const output = execSync(dockerCmd, { encoding: 'utf-8' });

        if (!output || output.trim() === '') {
          console.log(chalk.yellow('⚠️'), 'No logs available.');
          console.log('\nPossible causes:');
          console.log('  - Services are not running (run "light up" first)');
          console.log('  - Services have not generated any logs yet');
          if (service) {
            console.log(`  - Service "${service}" does not exist`);
          }
        } else {
          // Color-code log output by service
          const lines = output.split('\n');
          lines.forEach(line => {
            if (line.includes('ERROR') || line.includes('error')) {
              console.log(chalk.red(line));
            } else if (line.includes('WARN') || line.includes('warning')) {
              console.log(chalk.yellow(line));
            } else if (line.includes('INFO') || line.includes('info')) {
              console.log(chalk.blue(line));
            } else if (line.includes('DEBUG') || line.includes('debug')) {
              console.log(chalk.gray(line));
            } else {
              console.log(line);
            }
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('no such service')) {
          throw new Error(`Service "${service}" not found. Run "light status" to see available services.`);
        }
        throw error;
      }
    }

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof Error) {
      if (error.message.includes('no containers')) {
        console.log('\nCause: No containers are running');
        console.log('Solution: Run "light up" to start the environment');
      } else if (error.message.includes('no configuration')) {
        console.log('\nCause: Docker Compose configuration is missing');
        console.log('Solution: Run "light init" to set up the project');
      }
    }

    process.exit(1);
  }
}