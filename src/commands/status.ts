import { existsSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { loadProjectConfig } from '../utils/config.js';

interface StatusOptions {
  format?: 'table' | 'json';
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  port?: string;
  url?: string;
}

interface DockerPublisher {
  PublishedPort: number;
  TargetPort: number;
  URL?: string;
  Protocol: string;
}

interface DockerContainer {
  Service?: string;
  Name?: string;
  State?: string;
  Status?: string;
  Publishers?: DockerPublisher[];
}

export function statusCommand(options: StatusOptions = {}) {
  try {
    const format = options.format || 'table';

    // Load project configuration
    const configResult = loadProjectConfig();
    if (!configResult.config) {
      throw new Error(configResult.error || 'No Lightstack project found. Run "light init" first.');
    }

    // Check if Docker is running
    try {
      execSync('docker info', { stdio: 'ignore' });
    } catch {
      throw new Error('Docker is not running. Please start Docker Desktop and try again.');
    }

    // Get Docker Compose status
    const services = getDockerComposeStatus();

    if (format === 'json') {
      console.log(JSON.stringify(services, null, 2));
    } else {
      displayStatusTable(services);
    }

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof Error && error.message.includes('No containers found')) {
      console.log('\nCause: The development environment is not running');
      console.log('Solution: Run "light up" to start the environment');
    }

    process.exit(1);
  }
}

function getDockerComposeStatus(): ServiceStatus[] {
  const services: ServiceStatus[] = [];
  const envFileArg = existsSync('.env') ? '--env-file ./.env' : '';

  try {
    // Get list of services from docker compose ps
    const psOutput = execSync(
      `docker compose -f .light/docker-compose.yml -f .light/docker-compose.dev.yml ${envFileArg} ps --format json`.trim(),
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    if (!psOutput || psOutput.trim() === '') {
      throw new Error('No containers found for this project');
    }

    // Parse JSON output (each line is a separate JSON object)
    const lines = psOutput.trim().split('\n').filter(line => line.trim());

    lines.forEach(line => {
      try {
        const container = JSON.parse(line) as DockerContainer;
        const service: ServiceStatus = {
          name: container.Service || container.Name || 'unknown',
          status: getServiceStatus(container.State || container.Status || 'unknown'),
        };

        // Extract port if available
        if (container.Publishers && Array.isArray(container.Publishers)) {
          const webPort = container.Publishers.find((p: DockerPublisher) =>
            p.PublishedPort === 443 || p.PublishedPort === 80 || p.PublishedPort === 3000
          );
          if (webPort) {
            service.port = webPort.PublishedPort.toString();
          }
        }

        // Add URLs for known services
        if (service.name === 'traefik') {
          service.url = 'https://router.lvh.me';
        } else if (service.name === 'app') {
          service.url = 'https://app.lvh.me';
        }

        services.push(service);
      } catch (parseError) {
        // Skip invalid lines
      }
    });

    // Also check for BaaS services running locally
    const baasServices = checkBaaSServices();
    services.push(...baasServices);

  } catch (error) {
    if (error instanceof Error && error.message.includes('no configuration file provided')) {
      throw new Error('Docker Compose files not found. Run "light init" to regenerate them.');
    }
    throw error;
  }

  return services;
}

function getServiceStatus(state: string): 'running' | 'stopped' | 'error' {
  const normalizedState = state.toLowerCase();

  if (normalizedState.includes('running') || normalizedState.includes('up')) {
    return 'running';
  } else if (normalizedState.includes('exit') || normalizedState.includes('stop')) {
    return 'stopped';
  } else if (normalizedState.includes('error') || normalizedState.includes('dead')) {
    return 'error';
  }

  return 'stopped';
}

function checkBaaSServices(): ServiceStatus[] {
  const services: ServiceStatus[] = [];

  // Check if Supabase is running
  if (existsSync('supabase/config.toml')) {
    try {
      // Check if Supabase is running by testing the health endpoint
      execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:54321/rest/v1/', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      services.push(
        {
          name: 'supabase-api',
          status: 'running',
          port: '54321',
          url: 'https://api.lvh.me'
        },
        {
          name: 'supabase-studio',
          status: 'running',
          port: '54323',
          url: 'https://studio.lvh.me'
        }
      );
    } catch {
      services.push(
        {
          name: 'supabase',
          status: 'stopped',
          port: '54321'
        }
      );
    }
  }

  return services;
}

function displayStatusTable(services: ServiceStatus[]) {
  if (services.length === 0) {
    console.log(chalk.yellow('⚠️'), 'No services found. Run "light up" to start the environment.');
    return;
  }

  console.log('\n' + chalk.bold('Service Status:'));
  console.log('─'.repeat(60));

  // Calculate column widths
  const nameWidth = Math.max(15, ...services.map(s => s.name.length)) + 2;
  const statusWidth = 10;
  const portWidth = 8;

  // Header
  console.log(
    chalk.gray('Service').padEnd(nameWidth) +
    chalk.gray('Status').padEnd(statusWidth) +
    chalk.gray('Port').padEnd(portWidth) +
    chalk.gray('URL')
  );
  console.log('─'.repeat(60));

  // Service rows
  services.forEach(service => {
    const statusColor = service.status === 'running' ? chalk.green :
                       service.status === 'error' ? chalk.red :
                       chalk.yellow;

    const statusIcon = service.status === 'running' ? '✅' :
                      service.status === 'error' ? '❌' :
                      '⚠️';

    console.log(
      service.name.padEnd(nameWidth) +
      (statusIcon + ' ' + statusColor(service.status)).padEnd(statusWidth + 10) + // Extra padding for emoji
      (service.port || '-').padEnd(portWidth) +
      (service.url || '-')
    );
  });

  console.log('─'.repeat(60));

  // Summary
  const runningCount = services.filter(s => s.status === 'running').length;
  const stoppedCount = services.filter(s => s.status === 'stopped').length;
  const errorCount = services.filter(s => s.status === 'error').length;

  console.log('\n' + chalk.bold('Summary:'));
  if (runningCount > 0) console.log(chalk.green(`  ✅ ${runningCount} running`));
  if (stoppedCount > 0) console.log(chalk.yellow(`  ⚠️  ${stoppedCount} stopped`));
  if (errorCount > 0) console.log(chalk.red(`  ❌ ${errorCount} error`));

  if (runningCount === services.length) {
    console.log('\n' + chalk.green('All services are running! 🚀'));
  } else if (stoppedCount === services.length) {
    console.log('\n' + chalk.yellow('All services are stopped. Run "light up" to start.'));
  }
}