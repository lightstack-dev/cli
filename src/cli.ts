#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { initCommand } from './commands/init.js';

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
  .option('--template <name>', 'Project template (nuxt, sveltekit)', 'nuxt')
  .option('--force', 'Overwrite existing configuration')
  .action((projectName, options) => {
    initCommand(projectName, options);
  });

program
  .command('up')
  .description('Start development environment')
  .option('--env <name>', 'Environment to use', 'development')
  .option('--build', 'Force rebuild of containers')
  .option('--detach', 'Run in background', true)
  .action((options) => {
    console.log(chalk.red('❌ Error: Command not implemented yet'));
    console.log('This will start the development environment');
    console.log('Options:', options);
    process.exit(1);
  });

program
  .command('deploy')
  .description('Deploy application to specified environment')
  .argument('[environment]', 'Target environment', 'production')
  .option('--dry-run', 'Show what would be deployed without executing')
  .option('--build', 'Force rebuild before deployment')
  .option('--rollback', 'Rollback to previous deployment')
  .action(async (environment, options) => {
    console.log(chalk.red('❌ Error: Command not implemented yet'));
    console.log('This will deploy to environment:', environment);
    console.log('Options:', options);
    process.exit(1);
  });

program
  .command('status')
  .description('Show project and service status')
  .option('--format <format>', 'Output format (table, json)', 'table')
  .action(async (options) => {
    console.log(chalk.red('❌ Error: Command not implemented yet'));
    console.log('This will show project status');
    console.log('Options:', options);
    process.exit(1);
  });

program
  .command('logs')
  .description('Show logs from services')
  .argument('[service]', 'Specific service name (defaults to all services)')
  .option('--follow', 'Follow log output in real-time')
  .option('--tail <lines>', 'Number of lines to show', '50')
  .action(async (service, options) => {
    console.log(chalk.red('❌ Error: Command not implemented yet'));
    console.log('This will show logs for service:', service || 'all services');
    console.log('Options:', options);
    process.exit(1);
  });

program
  .command('down')
  .description('Stop development environment')
  .option('--volumes', 'Remove volumes as well (data loss warning)')
  .action(async (options) => {
    console.log(chalk.red('❌ Error: Command not implemented yet'));
    console.log('This will stop the development environment');
    console.log('Options:', options);
    process.exit(1);
  });

// Command aliases
program.command('start').description('Alias for "up"').action(() => {
  console.log(chalk.red('❌ Error: Command not implemented yet'));
  console.log('This is an alias for: light up');
  process.exit(1);
});
program.command('stop').description('Alias for "down"').action(() => {
  console.log(chalk.red('❌ Error: Command not implemented yet'));
  console.log('This is an alias for: light down');
  process.exit(1);
});
program.command('ps').description('Alias for "status"').action(() => {
  console.log(chalk.red('❌ Error: Command not implemented yet'));
  console.log('This is an alias for: light status');
  process.exit(1);
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