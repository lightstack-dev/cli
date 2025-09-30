#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { initCommand } from './commands/init.js';
import { upCommand } from './commands/up.js';
import { downCommand } from './commands/down.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { deployCommand } from './commands/deploy.js';
import { envCommand } from './commands/env.js';

// Get package.json for version and update checks
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
) as { name: string; version: string };

// Check for updates
const notifier = updateNotifier({
  pkg: packageJson,
  updateCheckInterval: 1000 * 60 * 60 * 24 // Daily
});
notifier.notify({ isGlobal: true });

// Configure CLI
program
  .name('light')
  .description('Orchestrate your development workflow from local to production')
  .version(packageJson.version, '-v, --version', 'Show CLI version')
  .helpOption('-h, --help', 'Show help')
  .addHelpCommand('help [command]', 'Show help for a command');

// Global options
program
  .option('--no-color', 'Disable colored output')
  .option('--verbose', 'Show detailed output')
  .option('--quiet', 'Show minimal output');

// Commands
program
  .command('init')
  .description('Initialize a new Lightstack project')
  .argument('[project-name]', 'Project name (defaults to current directory name)')
  .option('--force', 'Overwrite existing configuration')
  .action((projectName: string | undefined, options: unknown) => {
    initCommand(projectName, options as { force?: boolean });
  });

program
  .command('up')
  .description('Start local development or production stack')
  .argument('[environment]', 'Target environment (development, production, etc.)', 'development')
  .option('--detach', 'Run in background', true)
  .action(async (environment: string, options: unknown) => {
    await upCommand({ env: environment, ...(options as { detach?: boolean }) });
  });

program
  .command('deploy')
  .description('Deploy application to specified environment')
  .argument('[environment]', 'Target environment', 'production')
  .option('--dry-run', 'Show what would be deployed without executing')
  .option('--build', 'Force rebuild before deployment')
  .option('--rollback', 'Rollback to previous deployment')
  .action((environment: string, options: unknown) => {
    deployCommand(environment, options as { dryRun?: boolean; build?: boolean; rollback?: boolean });
  });

program.addCommand(envCommand());

program
  .command('status')
  .description('Show project and service status')
  .option('--format <format>', 'Output format (table, json)', 'table')
  .action((options: unknown) => {
    statusCommand(options as { format?: 'table' | 'json' });
  });

program
  .command('logs')
  .description('Show logs from services')
  .argument('[service]', 'Specific service name (defaults to all services)')
  .option('--follow', 'Follow log output in real-time')
  .option('--tail <lines>', 'Number of lines to show', '50')
  .action((service: string | undefined, options: unknown) => {
    logsCommand(service, options as { follow?: boolean; tail?: string });
  });

program
  .command('down')
  .description('Stop local proxy')
  .option('--volumes', 'Remove volumes as well (data loss warning)')
  .action((options: unknown) => {
    downCommand(options as { volumes?: boolean });
  });

// Command aliases
program.command('start').description('Alias for "up"').action(async () => {
  await upCommand({ env: 'development', detach: true });
});
program.command('stop').description('Alias for "down"').action(() => {
  downCommand({ volumes: false });
});
program.command('ps').description('Alias for "status"').action(() => {
  statusCommand({ format: 'table' });
});

// Error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
  throw error;
}