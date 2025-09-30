import { Command } from 'commander';
import chalk from 'chalk';
import { input, confirm, select } from '@inquirer/prompts';
import { loadProjectConfig, type DeploymentConfig } from '../utils/config.js';
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';

export function envCommand() {
  const env = new Command('env')
    .description('Manage deployment environments')
    .alias('envs')
    .alias('environments');

  env
    .command('add <name>')
    .description('Add a new deployment environment')
    .option('--host <host>', 'SSH host address')
    .option('--domain <domain>', 'Domain name for this environment')
    .option('--user <user>', 'SSH user')
    .option('--port <port>', 'SSH port', '22')
    .option('--no-ssl', 'Disable SSL')
    .option('--ssl-email <email>', 'Email for Let\'s Encrypt SSL')
    .action(addEnvironment);

  env
    .command('list')
    .description('List all configured environments')
    .alias('ls')
    .action(listEnvironments);

  env
    .command('remove <name>')
    .description('Remove an environment')
    .alias('rm')
    .alias('delete')
    .option('-f, --force', 'Skip confirmation')
    .action(removeEnvironment);

  return env;
}

interface EnvAddOptions {
  host?: string;
  domain?: string;
  user?: string;
  port?: string;
  ssl?: boolean;
  sslEmail?: string;
}

async function addEnvironment(name: string, options: EnvAddOptions) {
  try {
    // Load current config
    const configResult = loadProjectConfig();
    if (!configResult.config || !configResult.filepath) {
      throw new Error('No Lightstack project found. Run "light init" first.');
    }

    // Check if environment already exists
    const existingEnv = configResult.config.deployments?.find(d => d.name === name);
    if (existingEnv) {
      throw new Error(`Environment '${name}' already exists. Edit it in ${configResult.filepath}`);
    }

    // Validate environment name
    const validName = /^[a-z0-9-]+$/.test(name);
    if (!validName) {
      throw new Error('Environment name must contain only lowercase letters, numbers, and hyphens');
    }

    console.log(chalk.blue('📍'), `Deployment target configuration for '${name}'\n`);

    // Collect configuration via prompts or options
    const host = options.host || await input({
      message: 'Host (SSH address):',
      validate: (value: string) => value.length > 0 || 'Host is required'
    });

    const domain = options.domain || await input({
      message: 'Domain:',
      validate: (value: string) => value.length > 0 || 'Domain is required'
    });

    const user = options.user || await input({
      message: 'SSH user:',
      default: 'ubuntu'
    });

    const portStr = options.port || await input({
      message: 'SSH port:',
      default: '22'
    });
    const port = parseInt(portStr);

    let sslConfig = undefined;
    if (options.ssl !== false) {
      // Only prompt if not explicitly disabled via --no-ssl
      const enableSsl = options.ssl === undefined ? await confirm({
        message: 'Enable SSL?',
        default: true
      }) : true;

      if (enableSsl) {
        // Only prompt for provider if not running with command line flags
        const sslProvider = options.sslEmail ? 'letsencrypt' : await select({
          message: 'SSL provider:',
          choices: [
            { name: 'Let\'s Encrypt (automatic)', value: 'letsencrypt' },
            { name: 'Manual (bring your own certs)', value: 'manual' }
          ],
          default: 'letsencrypt'
        });

        let sslEmail = undefined;
        if (sslProvider === 'letsencrypt') {
          sslEmail = options.sslEmail || await input({
            message: 'SSL email (for Let\'s Encrypt notifications):',
            validate: (value: string) => {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              return emailRegex.test(value) || 'Please enter a valid email address';
            }
          });
        }

        sslConfig = {
          enabled: true,
          provider: sslProvider as 'letsencrypt' | 'manual',
          ...(sslEmail && { email: sslEmail })
        };
      }
    }

    // Create deployment configuration
    const newDeployment: DeploymentConfig = {
      name,
      host,
      domain,
      port,
      user,
      ...(sslConfig && { ssl: sslConfig })
    };

    // Update config file
    updateConfigFile(configResult.filepath, configResult.config, newDeployment);

    console.log('\n' + chalk.green('✅'), `Added '${name}' environment to ${configResult.filepath}`);
    console.log('\nTo deploy:', chalk.cyan(`light deploy ${name}`));
    console.log('To edit: Update the configuration in', chalk.cyan(configResult.filepath));

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

function listEnvironments() {
  try {
    const configResult = loadProjectConfig();
    if (!configResult.config) {
      throw new Error('No Lightstack project found. Run "light init" first.');
    }

    const deployments = configResult.config.deployments || [];

    if (deployments.length === 0) {
      console.log(chalk.yellow('No deployment environments configured.'));
      console.log('\nAdd one with:', chalk.cyan('light env add production'));
      return;
    }

    console.log(chalk.bold('Configured environments:\n'));

    deployments.forEach(env => {
      console.log(chalk.green('●'), chalk.bold(env.name));
      console.log('  Host:', env.host);
      console.log('  Domain:', env.domain || '(not set)');
      console.log('  User:', env.user || '(default)');
      console.log('  Port:', env.port || 22);
      console.log('  SSL:', env.ssl?.enabled ?
        `Enabled (${env.ssl.provider || 'letsencrypt'})` :
        'Disabled'
      );
      console.log();
    });

    console.log('Deploy with:', chalk.cyan('light deploy <environment>'));
    console.log('Edit in:', chalk.cyan(configResult.filepath || 'light.config.yml'));

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

interface EnvRemoveOptions {
  force?: boolean;
}

async function removeEnvironment(name: string, options: EnvRemoveOptions) {
  try {
    const configResult = loadProjectConfig();
    if (!configResult.config || !configResult.filepath) {
      throw new Error('No Lightstack project found. Run "light init" first.');
    }

    const deployments = configResult.config.deployments || [];
    const envIndex = deployments.findIndex(d => d.name === name);

    if (envIndex === -1) {
      throw new Error(`Environment '${name}' not found`);
    }

    // Confirm deletion
    if (!options.force) {
      const confirmed = await confirm({
        message: `Remove environment '${name}'?`,
        default: false
      });

      if (!confirmed) {
        console.log('Cancelled');
        return;
      }
    }

    // Remove from deployments array
    deployments.splice(envIndex, 1);
    configResult.config.deployments = deployments;

    // Write updated config
    const configContent = readFileSync(configResult.filepath, 'utf-8');
    const currentConfig = yaml.load(configContent) as ProjectConfigFile;
    currentConfig.deployments = deployments;

    const newContent = yaml.dump(currentConfig, {
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });

    writeFileSync(configResult.filepath, newContent);

    console.log(chalk.green('✅'), `Removed '${name}' environment`);

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

interface ProjectConfigFile {
  deployments?: DeploymentConfig[];
  [key: string]: unknown;
}

function updateConfigFile(filepath: string, _config: unknown, newDeployment: DeploymentConfig) {
  // Read the actual file content to preserve formatting and comments
  const configContent = readFileSync(filepath, 'utf-8');
  const currentConfig = yaml.load(configContent) as ProjectConfigFile;

  // Initialize deployments array if it doesn't exist
  if (!currentConfig.deployments) {
    currentConfig.deployments = [];
  }

  // Add new deployment
  currentConfig.deployments.push(newDeployment);

  // Write back with nice formatting
  const newContent = yaml.dump(currentConfig, {
    indent: 2,
    lineWidth: 80,
    noRefs: true
  });

  writeFileSync(filepath, newContent);
}