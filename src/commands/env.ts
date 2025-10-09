import { Command } from 'commander';
import chalk from 'chalk';
import { input, confirm, select } from '@inquirer/prompts';
import { loadProjectConfig, type DeploymentConfig } from '../utils/config.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import { getAcmeEmail, getUserConfigPath, hasAcmeEmail, setAcmeEmail } from '../utils/user-config.js';

/**
 * Extract base domain from app domain for smart subdomain defaults
 * Examples:
 *   app.example.com → example.com
 *   example.com → example.com
 *   app.subdomain.example.com → subdomain.example.com (keeps last 2 parts)
 */
function getBaseDomain(appDomain: string): string {
  const parts = appDomain.split('.');
  // If domain has 3+ parts (app.example.com), strip first part
  // If domain has 2 parts (example.com), keep as is
  if (parts.length >= 3) {
    return parts.slice(1).join('.');
  }
  return appDomain;
}

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

    // Collect configuration via prompts or options
    const appDomain = options.domain || await input({
      message: 'App domain:',
      validate: (value: string) => value.length > 0 || 'App domain is required'
    });

    // Check if project has Supabase (to determine if we need domain prompts for services)
    const hasSupabase = existsSync('supabase/config.toml');

    // Prompt for service domains if Supabase project exists
    let apiDomain: string | undefined;
    let studioDomain: string | undefined;

    if (hasSupabase) {
      console.log(chalk.blue('\nℹ'), 'Supabase project detected. Configure service domains:\n');

      // Smart defaults: if appDomain has subdomain, use base domain for services
      const baseDomain = getBaseDomain(appDomain);

      apiDomain = await input({
        message: 'API domain:',
        default: `api.${baseDomain}`,
        validate: (value: string) => value.length > 0 || 'API domain is required'
      });

      studioDomain = await input({
        message: 'Studio domain:',
        default: `studio.${baseDomain}`,
        validate: (value: string) => value.length > 0 || 'Studio domain is required'
      });

      console.log(); // Visual spacing
    }

    // Host is optional - defaults to appDomain for SSH
    const host = options.host || await input({
      message: 'SSH host:',
      default: appDomain
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
    let dnsApiKey: string | undefined = undefined;

    if (options.ssl !== false) {
      // Only prompt if not explicitly disabled via --no-ssl
      const enableSsl = options.ssl === undefined ? await confirm({
        message: 'Enable SSL?',
        default: true
      }) : true;

      if (enableSsl) {
        // Only prompt for provider if not running with command line flags
        const sslProvider = await select({
          message: 'SSL provider:',
          choices: [
            { name: 'Let\'s Encrypt (automatic)', value: 'letsencrypt' },
            { name: 'Manual (bring your own certs)', value: 'manual' }
          ],
          default: 'letsencrypt'
        });

        if (sslProvider === 'letsencrypt') {
          // Prompt for ACME email if not already configured
          if (!hasAcmeEmail()) {
            console.log(chalk.blue('ℹ'), 'ACME email is required for Let\'s Encrypt SSL certificates');
            const email = await input({
              message: 'Enter your email for ACME/Let\'s Encrypt:',
              validate: (value) => {
                if (!value) return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email';
                return true;
              }
            });
            setAcmeEmail(email);
            console.log(chalk.green('✓'), `ACME email saved to ${getUserConfigPath()}`);
          } else {
            console.log(chalk.blue('ℹ'), `Using ACME email: ${getAcmeEmail()} (from ${getUserConfigPath()})`);
          }

          // Prompt for DNS provider
          const dnsProvider = await select({
            message: 'DNS provider (for Let\'s Encrypt DNS challenge):',
            choices: [
              { name: 'Cloudflare', value: 'cloudflare' },
              { name: 'Route53 (AWS)', value: 'route53' },
              { name: 'DigitalOcean', value: 'digitalocean' },
              { name: 'Gandi', value: 'gandi' },
              { name: 'Namecheap', value: 'namecheap' }
            ],
            default: 'cloudflare'
          });

          // Prompt for DNS API key
          dnsApiKey = await input({
            message: 'DNS API key:',
            validate: (value: string) => value.length > 0 || 'DNS API key is required for Let\'s Encrypt'
          });

          sslConfig = {
            enabled: true,
            provider: sslProvider as 'letsencrypt' | 'manual',
            dnsProvider: dnsProvider as 'cloudflare' | 'route53' | 'digitalocean' | 'gandi' | 'namecheap'
            // DNS API key is stored in .env, not config file (secret should not be committed)
          };
        } else {
          sslConfig = {
            enabled: true,
            provider: sslProvider as 'letsencrypt' | 'manual'
          };
        }
      }
    }

    // Create deployment configuration
    const newDeployment: DeploymentConfig = {
      name,
      appDomain,
      ...(apiDomain && { apiDomain }),
      ...(studioDomain && { studioDomain }),
      ...(host !== appDomain && { host }), // Only include host if different from appDomain
      port,
      user,
      ...(sslConfig && { ssl: sslConfig })
    };

    // Update config file
    updateConfigFile(configResult.filepath, configResult.config, newDeployment);

    // Write DNS API key to .env if provided (secret should not be committed to config)
    if (dnsApiKey) {
      writeDnsApiKeyToEnv(name, dnsApiKey);
    }

    console.log('\n' + chalk.green('✓'), `Added '${name}' environment to ${configResult.filepath}`);
    if (dnsApiKey) {
      console.log(chalk.green('✓'), `DNS API key saved to .env (gitignored)`);
    }

    const acmeEmail = getAcmeEmail();
    if (acmeEmail) {
      console.log('\n' + chalk.blue('ℹ'), `ACME email already configured: ${acmeEmail} (from ${getUserConfigPath()})`);
    } else {
      console.log('\n' + chalk.yellow('!'), `ACME email not configured. Run "light init" to configure it.`);
    }

    console.log(chalk.bold('\nNext steps:'));
    console.log('  Test deployment locally:     ', chalk.cyan(`light up ${name}`));
    console.log('  Deploy to target environment:', chalk.cyan(`light deploy ${name}`));
    
    console.log(chalk.gray(`\nEdit configuration in ${configResult.filepath}`));
    console.log('');

  } catch (error) {
    console.error(chalk.red('✗'), error instanceof Error ? error.message : 'Unknown error');
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
      // Support both legacy 'domain' and new 'appDomain' fields
      const appDomain = env.appDomain || env.domain;

      console.log(chalk.green('*'), chalk.bold(env.name));
      console.log('  App domain:', appDomain);
      if (env.apiDomain) {
        console.log('  API domain:', env.apiDomain);
      }
      if (env.studioDomain) {
        console.log('  Studio domain:', env.studioDomain);
      }
      console.log('  SSH:', env.host ? `${env.host} (override)` : appDomain);
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
    console.error(chalk.red('✗'), error instanceof Error ? error.message : 'Unknown error');
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

    console.log(chalk.green('✓'), `Removed '${name}' environment`);

  } catch (error) {
    console.error(chalk.red('✗'), error instanceof Error ? error.message : 'Unknown error');
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

function writeDnsApiKeyToEnv(envName: string, apiKey: string) {
  const envFile = '.env';
  const envKey = `${envName.toUpperCase()}_DNS_API_KEY`;

  let envContent = '';
  if (existsSync(envFile)) {
    envContent = readFileSync(envFile, 'utf-8');
  }

  // Check if key already exists
  const lines = envContent.split('\n');
  const existingIndex = lines.findIndex(line => line.startsWith(`${envKey}=`));

  if (existingIndex !== -1) {
    // Update existing
    lines[existingIndex] = `${envKey}=${apiKey}`;
  } else {
    // Add new (with section header if this is first env var)
    if (!envContent.includes('# Deployment secrets')) {
      lines.push('');
      lines.push('# Deployment secrets (not committed to git)');
    }
    lines.push(`${envKey}=${apiKey}`);
  }

  writeFileSync(envFile, lines.join('\n'));
}