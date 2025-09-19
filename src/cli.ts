#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';

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