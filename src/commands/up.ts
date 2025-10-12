import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { confirm } from '@inquirer/prompts';
import { setupMkcert, generateTraefikTlsConfig } from '../utils/mkcert.js';
import { getProjectConfig, type ServiceConfig } from '../utils/config.js';
import { generateSupabaseSecrets, generateSupabaseEnvFile } from '../utils/supabase-stack.js';
import { getSupabasePorts } from '../utils/supabase-config.js';
import { getAcmeEmail } from '../utils/user-config.js';
import { getDevCommand, getSupabaseCli } from '../utils/package-manager.js';
import { detectRunningEnvironment, checkSupabaseDevEnvironment as checkSupabaseDevPorts, checkPortConflicts, validateSSLProvider, type SSLProvider } from '../utils/docker.js';

interface UpOptions {
  env?: string;
  detach?: boolean;
  ca?: string;
}

// Helper functions to get domains with proper fallbacks
function getAppDomain(deployment: DeploymentConfig | undefined): string {
  if (!deployment) return 'local.lightstack.dev';
  // Support both legacy 'domain' and new 'appDomain' fields
  return deployment.appDomain || deployment.domain || 'local.lightstack.dev';
}

function getApiDomain(deployment: DeploymentConfig | undefined): string {
  if (!deployment) return 'api.local.lightstack.dev';
  const appDomain = getAppDomain(deployment);
  return deployment.apiDomain || `api.${appDomain}`;
}

function getStudioDomain(deployment: DeploymentConfig | undefined): string {
  if (!deployment) return 'studio.local.lightstack.dev';
  const appDomain = getAppDomain(deployment);
  return deployment.studioDomain || `studio.${appDomain}`;
}

interface DeploymentConfig {
  name: string;
  domain?: string; // Legacy field
  appDomain?: string;
  apiDomain?: string;
  studioDomain?: string;
  host?: string;
  port?: number;
  user?: string;
}

export async function upCommand(options: UpOptions = {}) {
  try {
    const env = options.env || 'development';

    // Load project configuration
    const projectConfig = getProjectConfig();

    // Check common prerequisites (Docker, config, environment exists)
    try {
      commonPrerequisiteChecks(env);
    } catch (error) {
      // If environment doesn't exist, offer to configure it interactively
      if (error instanceof Error && error.message.includes('not configured') && env !== 'development') {
        console.log(chalk.yellow('!'), `Environment '${env}' is not configured.`);

        const shouldConfigure = await confirm({
          message: `Would you like to configure the '${env}' environment now?`,
          default: true
        });

        if (shouldConfigure) {
          // Run light env add command
          const cliPath = process.argv[1] || 'light';
          const result = spawnSync('node', [cliPath, 'env', 'add', env], {
            stdio: 'inherit',
            shell: true
          });

          if (result.status !== 0) {
            throw new Error(`Failed to configure environment '${env}'`);
          }

          console.log('\n' + chalk.green('✓'), `Environment '${env}' configured. Now starting ${env} infrastructure...\n`);
        } else {
          console.log('\nTo configure later, run:', chalk.cyan(`light env add ${env}`));
          process.exit(0);
        }
      } else {
        // For other errors, rethrow
        throw error;
      }
    }

    // Check environment setup
    checkEnvironment(env);

    // Branch based on environment mode
    if (env === 'development') {
      // Development mode: Traefik proxy only, routes to localhost
      deployDevMode(projectConfig, options);
      return;
    }

    // Deployment mode: Full stack including Supabase
    await deployFullStackMode(projectConfig, env, options);

  } catch (error) {
    console.error(chalk.red('✗'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Deploy development mode: Traefik proxy only, routes to localhost services
 */
function deployDevMode(projectConfig: ReturnType<typeof getProjectConfig>, options: UpOptions) {
  const env = 'development';
  const detach = options.detach !== false;

  // Setup SSL certificates for development
  setupLocalSsl();

  // Generate BaaS proxy configs for development (proxy to Supabase CLI)
  generateBaaSProxyConfigs();

  // Check if infrastructure is already running
  const composeFiles = getComposeFiles(env);
  const expectedContainers = getExpectedContainers(projectConfig.name, composeFiles);
  const existingStatus = checkInfrastructureStatus(projectConfig.name, env);

  if (existingStatus.hasRunningContainers) {
    // Validate that all expected containers are running
    const validation = validateContainerStatus(expectedContainers, existingStatus);

    if (validation.valid) {
      console.log(chalk.green('✓'), `Lightstack infrastructure is already running (${env})`);
      // Show same helpful output as when starting fresh
      showRouterStatus(projectConfig, env);
      return;
    } else {
      console.log(chalk.yellow('!'), 'Infrastructure is incomplete, restarting...');
      if (validation.missing.length > 0) {
        console.log(chalk.gray('  Missing:'), validation.missing.join(', '));
      }
      if (validation.failed.length > 0) {
        console.log(chalk.gray('  Failed:'), validation.failed.join(', '));
      }
    }
  }

  // Get deployment config and domain for this environment
  const deployment = projectConfig.deployments?.find(d => d.name === env);
  const appDomain = getAppDomain(deployment);

  // Build Docker Compose command
  const dockerCmd = buildDockerCommand(composeFiles, { detach, projectName: projectConfig.name, env, domain: appDomain });

  console.log(chalk.blue('ℹ'), 'Starting router...');

  // Execute Docker Compose with error handling
  try {
    execSync(dockerCmd, {
      stdio: 'inherit',
      env: {
        ...process.env,
        DOMAIN: appDomain,
        PROJECT_NAME: projectConfig.name
      }
    });
  } catch (error) {
    console.log(chalk.yellow('\n!'), 'Docker Compose encountered an issue during startup');
    console.log(chalk.blue('ℹ'), 'Checking container status...\n');

    // Check which containers are actually running
    const status = checkInfrastructureStatus(projectConfig.name, env);

    if (status.hasRunningContainers) {
      console.log(chalk.yellow('!'), 'Some containers started successfully:');
      status.running.forEach(container => {
        console.log(chalk.green('  ✓'), container);
      });

      if (status.failed.length > 0) {
        console.log(chalk.yellow('\n!'), 'Some containers failed to start:');
        status.failed.forEach(container => {
          console.log(chalk.red('  ✗'), container);
        });
      }

      console.log(chalk.blue('\nℹ Recovery options:'));
      console.log('  1. Try running the command again:', chalk.cyan(`light up ${env}`));
      console.log('  2. Check logs for failed containers:', chalk.cyan('light logs'));
      console.log('  3. Stop and restart:', chalk.cyan('light down && light up ' + env));

      // Don't exit with error if some containers are running
      return;
    } else {
      console.log(chalk.red('✗'), 'No containers are running');
      console.log(chalk.blue('\nℹ Try:'));
      console.log('  1. Check Docker Desktop is running');
      console.log('  2. Clean up and retry:', chalk.cyan('light down && light up ' + env));
      throw new Error('Failed to start containers');
    }
  }

  console.log(chalk.green('✓'), 'Router started');

  showRouterStatus(projectConfig, env);
}

/**
 * Deploy full stack mode: Complete Supabase stack + containerized app
 */
async function deployFullStackMode(projectConfig: ReturnType<typeof getProjectConfig>, env: string, options: UpOptions) {
  const detach = options.detach !== false;

  // T018: Check for running Lightstack environments first
  const currentEnv = detectRunningEnvironment();
  if (currentEnv) {
    if (currentEnv === env) {
      // Same environment already running - show status and exit gracefully
      console.log(chalk.green('✓'), `Lightstack infrastructure is already running (${env})`);
      console.log('\n' + chalk.bold('Current status:'));
      const status = checkInfrastructureStatus(projectConfig.name, env);
      status.running.forEach(container => {
        console.log(chalk.green('  ✓'), container);
      });
      console.log('\nTo restart:', chalk.cyan(`light restart ${env}`));
      console.log('To stop:', chalk.cyan(`light down`));
      return;
    } else {
      // Different environment running - prompt to switch
      console.log(chalk.yellow('!'), `Environment '${currentEnv}' is currently running`);
      console.log(chalk.yellow('  Only one Lightstack environment can run at a time\n'));

      const shouldSwitch = await confirm({
        message: `Stop '${currentEnv}' and start '${env}'?`,
        default: true
      });

      if (shouldSwitch) {
        console.log(chalk.blue('ℹ'), `Stopping '${currentEnv}'...`);
        try {
          // Stop current environment
          const composeFiles = getComposeFiles(currentEnv);
          const fileArgs = composeFiles.map(f => `-f ${f}`).join(' ');
          execSync(`docker compose ${fileArgs} --project-name ${projectConfig.name} down`, {
            stdio: 'inherit'
          });
        } catch (error) {
          console.log(chalk.yellow('!'), 'Error stopping environment, continuing anyway...');
        }
        console.log();
      } else {
        console.log('\nCancelled. To start later:');
        console.log('  1. Stop current:', chalk.cyan(`light down`));
        console.log('  2. Start new:', chalk.cyan(`light up ${env}`));
        process.exit(0);
      }
    }
  }

  // T018: Check if ports 80/443 are occupied by non-Lightstack processes
  const portConflict = checkPortConflicts();
  if (portConflict) {
    const suggestedCommand = process.platform === 'win32'
      ? `taskkill /PID <pid> /F`
      : `kill <pid>`;
    throw new Error(
      `Ports ${portConflict.ports.join(', ')} are occupied by '${portConflict.process}'.\n\n` +
      `Stop it first: ${suggestedCommand}\n` +
      `Or use: light down (if it's from a previous Lightstack run)`
    );
  }

  console.log(chalk.blue('ℹ'), 'Setting up production Supabase stack...');

  // Validate prerequisites for Supabase stack deployment
  if (!existsSync('supabase')) {
    throw new Error(
      'No Supabase project found.\n\n' +
      'Supabase stack requires a Supabase project.\n' +
      'See: https://supabase.com/docs/guides/local-development'
    );
  }

  // Check for Supabase CLI
  const supabaseCli = getSupabaseCli();
  if (!supabaseCli) {
    throw new Error(
      'Supabase CLI not installed.\n\n' +
      'Supabase stack deployment requires the Supabase CLI for migrations.\n' +
      'Install: npm install -g supabase (or add as dev dependency)\n' +
      'See: https://supabase.com/docs/guides/local-development'
    );
  }

  // T019: Check if Supabase dev environment is running
  const supabaseDevRunning = checkSupabaseDevPorts();
  if (supabaseDevRunning) {
    console.log(chalk.yellow('!'), 'Supabase CLI development environment detected (ports 54321-54324)');
    console.log(chalk.yellow('  This conflicts with the deployment stack\n'));

    const shouldStop = await confirm({
      message: 'Stop Supabase CLI and continue with deployment stack?',
      default: true
    });

    if (shouldStop) {
      console.log(chalk.blue('ℹ'), 'Stopping Supabase CLI...');
      try {
        execSync('supabase stop', { stdio: 'inherit' });

        // Double-check all Supabase containers are stopped (supabase stop can be flaky)
        const remainingContainers = execSync('docker ps --filter "name=supabase_" --format "{{.Names}}"', {
          encoding: 'utf-8'
        }).trim();

        if (remainingContainers) {
          console.log(chalk.yellow('!'), 'Some Supabase containers still running, force stopping...');
          execSync(`docker stop ${remainingContainers.split('\n').join(' ')}`, { stdio: 'ignore' });
        }
      } catch (error) {
        console.log(chalk.yellow('!'), 'Error stopping Supabase CLI, continuing anyway...');
      }
      console.log();
    } else {
      console.log('\nCancelled. To start deployment stack later:');
      console.log('  1. Stop Supabase CLI:', chalk.cyan('supabase stop'));
      console.log('  2. Start deployment:', chalk.cyan(`light up ${env}`));
      process.exit(0);
    }
  }

  // T020: Determine SSL provider (mkcert by default, letsencrypt via --ca flag)
  const sslProvider = validateSSLProvider(options.ca);

  // For non-development environments, generate full Supabase stack
  // Get ACME email from user config (stored in ~/.lightstack/config.yml)
  const sslEmail = getAcmeEmail();
  if (sslProvider === 'letsencrypt' && !sslEmail) {
    console.log(chalk.yellow('!'), 'ACME email not configured');
    console.log(chalk.blue('ℹ'), 'Run', chalk.cyan('light init'), 'to configure ACME email for Let\'s Encrypt SSL');
    console.log('');
  }

  await generateProductionStack(projectConfig, env, sslEmail, sslProvider);

  // T029: Validate Dockerfile exists before attempting Docker Compose build
  if (!existsSync('Dockerfile')) {
    throw new Error(
      'No Dockerfile found in project root.\n\n' +
      'Deployment mode requires a Dockerfile to containerize your application.\n' +
      'Solution: Run ' + chalk.cyan('light init') + ' to generate a Dockerfile, or create one manually.'
    );
  }

  // Check if infrastructure is already running
  const composeFiles = getComposeFiles(env);
  const expectedContainers = getExpectedContainers(projectConfig.name, composeFiles);
  const existingStatus = checkInfrastructureStatus(projectConfig.name, env);

  if (existingStatus.hasRunningContainers) {
    // Validate that all expected containers are running
    const validation = validateContainerStatus(expectedContainers, existingStatus);

    if (validation.valid) {
      console.log(chalk.green('✓'), `Lightstack infrastructure is already running (${env})`);
      // Show same helpful output as when starting fresh
      showRouterStatus(projectConfig, env);
      return;
    } else {
      console.log(chalk.yellow('!'), 'Infrastructure is incomplete, restarting...');
      if (validation.missing.length > 0) {
        console.log(chalk.gray('  Missing:'), validation.missing.join(', '));
      }
      if (validation.failed.length > 0) {
        console.log(chalk.gray('  Failed:'), validation.failed.join(', '));
      }
    }
  }

  // Get deployment config and domain for this environment
  const deployment = projectConfig.deployments?.find(d => d.name === env);
  const appDomain = getAppDomain(deployment);

  // Build Docker Compose command
  const dockerCmd = buildDockerCommand(composeFiles, { detach, projectName: projectConfig.name, env, domain: appDomain });

  console.log(chalk.blue('ℹ'), 'Starting router...');

  // Execute Docker Compose with error handling
  try {
    execSync(dockerCmd, {
      stdio: 'inherit',
      env: {
        ...process.env,
        DOMAIN: appDomain,
        PROJECT_NAME: projectConfig.name
      }
    });
  } catch (error) {
    console.log(chalk.yellow('\n!'), 'Docker Compose encountered an issue during startup');
    console.log(chalk.blue('ℹ'), 'Checking container status...\n');

    // Check which containers are actually running
    const status = checkInfrastructureStatus(projectConfig.name, env);

    if (status.hasRunningContainers) {
      console.log(chalk.yellow('!'), 'Some containers started successfully:');
      status.running.forEach(container => {
        console.log(chalk.green('  ✓'), container);
      });

      if (status.failed.length > 0) {
        console.log(chalk.yellow('\n!'), 'Some containers failed to start:');
        status.failed.forEach(container => {
          console.log(chalk.red('  ✗'), container);
        });
      }

      console.log(chalk.blue('\nℹ Recovery options:'));
      console.log('  1. Try running the command again:', chalk.cyan(`light up ${env}`));
      console.log('  2. Check logs for failed containers:', chalk.cyan('light logs'));
      console.log('  3. Stop and restart:', chalk.cyan('light down && light up ' + env));

      // Don't exit with error if some containers are running
      return;
    } else {
      console.log(chalk.red('✗'), 'No containers are running');
      console.log(chalk.blue('\nℹ Try:'));
      console.log('  1. Check Docker Desktop is running');
      console.log('  2. Clean up and retry:', chalk.cyan('light down && light up ' + env));
      throw new Error('Failed to start containers');
    }
  }

  console.log(chalk.green('✓'), 'Router started');

  // Run database migrations for production Supabase stacks
  if (env !== 'development' && existsSync('supabase')) {
    if (supabaseCli) {
      runSupabaseMigrations(projectConfig.name, env, supabaseCli);
    }
  }

  showRouterStatus(projectConfig, env);
}

/**
 * Common prerequisite checks for both development and deployment modes
 */
function commonPrerequisiteChecks(env: string) {
  // Check if project is initialized
  if (!existsSync('light.config.yml') && !existsSync('light.config.yml')) {
    throw new Error('No Lightstack project found. Run "light init" first.');
  }

  // Check if Docker is running
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch {
    throw new Error('Docker is not running. Please start Docker Desktop and try again.');
  }

  // Check if required Docker Compose files exist
  if (!existsSync('.light/docker-compose.yml')) {
    throw new Error('Docker Compose files not found. Run "light init" to regenerate them.');
  }

  // Check if environment is configured for non-development
  if (env !== 'development') {
    const projectConfig = getProjectConfig();
    const envExists = projectConfig.deployments?.some(d => d.name === env);
    if (!envExists) {
      throw new Error(
        `Environment '${env}' is not configured.\n` +
        `Run: light env add ${env}`
      );
    }
  }
}

function checkEnvironment(env: string) {
  const warnings: string[] = [];

  // For non-development environments, check if SSL email is configured in .env
  if (env !== 'development') {
    const projectConfig = getProjectConfig();
    const deployment = projectConfig.deployments?.find(d => d.name === env);

    // Check for environment-specific email key (e.g., PRODUCTION_ACME_EMAIL)
    const envKey = `${env.toUpperCase()}_ACME_EMAIL`;
    let hasEmail = false;

    if (existsSync('.env')) {
      try {
        const envContent = readFileSync('.env', 'utf-8');
        const envVars: Record<string, string> = {};
        envContent
          .split('\n')
          .filter(line => line && !line.startsWith('#'))
          .forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key?.trim()) {
              envVars[key.trim()] = valueParts.join('=').trim();
            }
          });
        hasEmail = !!envVars[envKey] || !!envVars.ACME_EMAIL; // Check both specific and generic
      } catch (error) {
        warnings.push('Could not parse .env file. Check for syntax errors.');
      }
    }

    // Only warn if SSL is Let's Encrypt and no email is configured
    if (deployment?.ssl?.provider === 'letsencrypt' && !hasEmail) {
      warnings.push(`${envKey} not set in .env. Required for Let's Encrypt SSL certificates.`);
    }
  }

  // Check if .env file exists (informational only)
  if (!existsSync('.env')) {
    const projectConfig = getProjectConfig();
    console.log(chalk.blue('ℹ'), 'No .env file found. Using built-in defaults', chalk.gray(`(PROJECT_NAME=${projectConfig.name}, APP_PORT=3000)`) + '.');
    console.log(chalk.blue('ℹ'), 'Create a .env file if you need custom environment variables.');
    console.log(); // Empty line for spacing
  }

  // Show warnings if any
  if (warnings.length > 0) {
    console.log(chalk.yellow('! Warning:'));
    warnings.forEach(warning => {
      console.log(chalk.yellow(`  ${warning}`));
    });
    console.log(); // Empty line for spacing
  }
}

function getComposeFiles(env: string): string[] {
  const baseFile = '.light/docker-compose.yml';
  const envFile = `.light/docker-compose.${env}.yml`;
  const supabaseOverridesFile = '.light/docker-compose.supabase-overrides.yml';

  const files = [baseFile];

  if (existsSync(envFile)) {
    files.push(envFile);
  }

  // Add Supabase overrides file if it exists (for production with Supabase)
  if (env !== 'development' && existsSync(supabaseOverridesFile)) {
    files.push(supabaseOverridesFile);
  }

  return files;
}

function buildDockerCommand(
  composeFiles: string[],
  options: { detach: boolean; projectName: string; env: string; domain: string }
): string {
  const fileArgs = composeFiles.map(f => `-f ${f}`).join(' ');
  const projectArg = `--project-name ${options.projectName}`;

  // Build env-file arguments
  const envFileArgs: string[] = [];

  // For production environments, load .light/.env first (Supabase vars)
  if (options.env !== 'development' && existsSync('.light/.env')) {
    envFileArgs.push('--env-file ./.light/.env');
  }

  // Then load user's .env (can override Supabase vars if needed)
  if (existsSync('.env')) {
    envFileArgs.push('--env-file ./.env');
  }

  const envFileArg = envFileArgs.join(' ');
  const detachFlag = options.detach ? '-d' : '';

  // Note: DOMAIN and PROJECT_NAME environment variables are set via execSync env option
  // This ensures cross-platform compatibility (Windows doesn't support VARIABLE=value syntax)
  return `docker compose ${projectArg} ${fileArgs} ${envFileArg} up ${detachFlag}`.trim();
}

function generateBaaSProxyConfigs() {
  // Create traefik directory
  mkdirSync('.light/traefik', { recursive: true });

  // Generate dynamic configuration for all services (app + BaaS)
  const detectedBaaSServices = detectBaaSServices();
  const projectConfig = getProjectConfig();
  const dynamicConfig = generateTraefikDynamicConfig(projectConfig.services, detectedBaaSServices);
  writeFileSync('.light/traefik/dynamic.yml', dynamicConfig);

  // Supabase detection happens silently - URLs shown in final output
}

function detectBaaSServices(): string[] {
  const services: string[] = [];

  // Check for Supabase
  if (existsSync('supabase/config.toml')) {
    services.push('Supabase');
  }

  // Future: Add other BaaS detection here
  // if (existsSync('firebase.json')) services.push('Firebase');
  // if (existsSync('amplify/.config/project-config.json')) services.push('Amplify');

  return services;
}

interface TraefikRouter {
  rule: string;
  service: string;
  tls: boolean;
}

interface TraefikService {
  loadBalancer: {
    servers: { url: string }[];
  };
}

interface TraefikDynamicConfig {
  http: {
    routers: Record<string, TraefikRouter>;
    services: Record<string, TraefikService>;
  };
}

function setupLocalSsl(): void {
  const mkcertResult = setupMkcert();

  if (mkcertResult.certsGenerated && mkcertResult.certPath && mkcertResult.keyPath) {
    // Generate Traefik TLS configuration
    const tlsConfig = generateTraefikTlsConfig(mkcertResult.certPath, mkcertResult.keyPath);

    // Create traefik directory if it doesn't exist
    mkdirSync('.light/traefik', { recursive: true });

    // Write TLS configuration
    writeFileSync('.light/traefik/tls.yml', tlsConfig);
  } else {
    console.log(chalk.yellow('!'), 'Running without SSL. Install mkcert for HTTPS support.');
  }
}

function generateTraefikDynamicConfig(appServices: ServiceConfig[], baasServices: string[]): string {
  const config: TraefikDynamicConfig = {
    http: {
      routers: {},
      services: {}
    }
  };

  // Add Traefik dashboard route
  config.http.routers['traefik-dashboard'] = {
    rule: 'Host(`router.lvh.me`)',
    service: 'api@internal',
    tls: true
  };

  // Add routes for app services (proxying to localhost)
  appServices.forEach(service => {
    const routerName = service.name;
    const serviceName = `${service.name}-service`;

    config.http.routers[routerName] = {
      rule: `Host(\`${service.name}.lvh.me\`)`,
      service: serviceName,
      tls: true
    };

    config.http.services[serviceName] = {
      loadBalancer: {
        servers: [{ url: `http://host.docker.internal:${service.port}` }]
      }
    };
  });

  // Add routes for BaaS services
  baasServices.forEach(service => {
    if (service === 'Supabase') {
      const supabasePorts = getSupabasePorts();

      // Supabase API
      config.http.routers['supabase-api'] = {
        rule: 'Host(`api.lvh.me`)',
        service: 'supabase-api',
        tls: true
      };
      config.http.services['supabase-api'] = {
        loadBalancer: {
          servers: [{ url: `http://host.docker.internal:${supabasePorts.api}` }]
        }
      };

      // Supabase Studio (Database UI)
      config.http.routers['supabase-studio'] = {
        rule: 'Host(`studio.lvh.me`)',
        service: 'supabase-studio',
        tls: true
      };
      config.http.services['supabase-studio'] = {
        loadBalancer: {
          servers: [{ url: `http://host.docker.internal:${supabasePorts.studio}` }]
        }
      };
    }
  });

  return yaml.dump(config, {
    indent: 2,
    lineWidth: 80,
    noRefs: true
  });
}

async function generateProductionStack(projectConfig: ReturnType<typeof getProjectConfig>, env: string, _sslEmail?: string, _sslProvider?: SSLProvider) {
  console.log(chalk.blue('ℹ'), `Preparing production environment for ${env}...`);

  // Get domains from deployment config
  const deployment = projectConfig.deployments?.find(d => d.name === env);
  const appDomain = getAppDomain(deployment);
  const apiDomain = getApiDomain(deployment);
  const studioDomain = getStudioDomain(deployment);

  // Ensure Supabase template files are bundled (copy if missing)
  if (!existsSync('.light/supabase/docker-compose.yml')) {
    console.log(chalk.blue('ℹ'), 'Bundling official Supabase stack...');

    const path = await import('path');
    const url = await import('url');
    const files = await import('../utils/files.js');

    // Get current module directory
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const templateDir = path.join(__dirname, '..', '..', 'templates', 'supabase');
    const targetDir = '.light/supabase';

    files.copyDirectory(templateDir, targetDir);
  }

  // Ensure production secrets exist in .env
  const secrets = loadOrGenerateSecrets(env);

  if (secrets.generated) {
    console.log(chalk.green('✓'), `Production secrets generated in .env`);
    console.log(chalk.blue('ℹ'), 'Secrets are stored locally and gitignored\n');
  } else {
    console.log(chalk.blue('ℹ'), 'Using existing production secrets from .env\n');
  }

  // Generate .light/.env with Supabase-format environment variables
  // This file is separate from user's .env to keep things clean
  // CRITICAL: Only regenerate if database is not initialized, to preserve database user passwords
  const supabaseEnvPath = '.light/.env';
  const dbDataPath = '.light/supabase/volumes/db/data';
  const dbIsInitialized = existsSync(dbDataPath) && existsSync(`${dbDataPath}/PG_VERSION`);

  if (!dbIsInitialized) {
    // Fresh database - generate new .light/.env from current secrets
    const supabaseEnv = generateSupabaseEnvFile(env, projectConfig.name, appDomain, apiDomain, studioDomain, secrets.secrets);
    writeFileSync(supabaseEnvPath, supabaseEnv);
  } else if (!existsSync(supabaseEnvPath)) {
    // Database exists but .light/.env is missing - this shouldn't happen, but handle it
    console.log(chalk.yellow('!'), 'Database exists but .light/.env is missing');
    console.log(chalk.yellow('   This may cause authentication failures'));
    console.log(chalk.yellow('   To reset: light down --volumes && light up ' + env + '\n'));
  }

  // Create necessary directories
  mkdirSync('.light/supabase/volumes/db/data', { recursive: true });
  mkdirSync('.light/supabase/volumes/storage', { recursive: true });
  mkdirSync('.light/traefik', { recursive: true });

  // Generate Traefik dynamic config for production (no localhost proxying)
  const dynamicConfig = generateProductionTraefikConfig(projectConfig.services, appDomain);
  writeFileSync('.light/traefik/dynamic.yml', dynamicConfig);
}

function generateProductionTraefikConfig(_appServices: ServiceConfig[], _domain: string): string {
  // T028: In deployment mode, the app is containerized and configured via Docker labels
  // No need for file-based routing - Traefik auto-discovers via Docker provider
  const config: TraefikDynamicConfig = {
    http: {
      routers: {},
      services: {}
    }
  };

  // Note: App service routing is configured via Traefik labels in docker-compose.deployment.yml
  // Note: Supabase services (Kong, Studio) are configured via Docker labels in docker-compose.supabase-overrides.yml
  // This file is intentionally minimal for deployment mode

  return yaml.dump(config, {
    indent: 2,
    lineWidth: 80,
    noRefs: true
  });
}

interface ContainerStatus {
  hasRunningContainers: boolean;
  running: string[];
  failed: string[];
  created: string[];
}

function checkInfrastructureStatus(projectName: string, env: string): ContainerStatus {
  const status: ContainerStatus = {
    hasRunningContainers: false,
    running: [],
    failed: [],
    created: []
  };

  try {
    // Check for all Lightstack containers (router + optional Supabase stack)
    // In production mode, we need both router and Supabase containers
    const filter = env === 'development'
      ? `name=^${projectName}-router$`  // Dev: just router
      : `name=${projectName}-`;          // Prod: router + all Supabase services

    const output = execSync(
      `docker ps -a --filter "${filter}" --format "{{.Names}}\t{{.Status}}"`,
      { encoding: 'utf-8' }
    );

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (!line) continue;

      const [name, statusText] = line.split('\t');
      if (!name || !statusText) continue;

      if (statusText.includes('Up')) {
        status.running.push(`${name} (${statusText.includes('healthy') ? 'healthy' : statusText.includes('unhealthy') ? 'unhealthy' : 'running'})`);
        status.hasRunningContainers = true;
      } else if (statusText.includes('Exited') || statusText.includes('Dead')) {
        status.failed.push(`${name} (${statusText})`);
      } else if (statusText.includes('Created')) {
        status.created.push(`${name} (not started)`);
      }
    }

    // Count created containers as potentially failed if nothing is running
    if (!status.hasRunningContainers && status.created.length > 0) {
      status.failed.push(...status.created);
      status.created = [];
    }

  } catch (error) {
    // If docker ps fails, we can't check status
    console.log(chalk.yellow('!'), 'Unable to check container status');
  }

  return status;
}

/**
 * Get expected container names based on environment and compose files
 */
function getExpectedContainers(projectName: string, composeFiles: string[]): string[] {
  const containers = [
    `${projectName}-router`  // Always expect router
  ];

  // If Supabase stack is included, add all Supabase service containers
  if (composeFiles.some(f => f.includes('supabase'))) {
    containers.push(
      `${projectName}-db`,         // PostgreSQL
      `${projectName}-kong`,       // Kong API Gateway
      `${projectName}-auth`,       // GoTrue Auth
      `${projectName}-rest`,       // PostgREST
      `${projectName}-realtime`,   // Realtime
      `${projectName}-storage`,    // Storage
      `${projectName}-studio`,     // Studio UI
      `${projectName}-meta`,       // Meta service
      `${projectName}-analytics`,  // Analytics (Logflare)
      `${projectName}-vector`      // Vector (Log collection)
    );
  }

  return containers;
}

/**
 * Validate that all expected containers are running
 */
function validateContainerStatus(
  expectedContainers: string[],
  actualStatus: ContainerStatus
): { valid: boolean; missing: string[]; failed: string[] } {
  const runningNames = actualStatus.running.map(r => r.split(' ')[0]);
  const failedNames = actualStatus.failed.map(f => f.split(' ')[0]);

  const missing = expectedContainers.filter(name =>
    !runningNames.includes(name) && !failedNames.includes(name)
  );

  const failed = expectedContainers.filter(name => failedNames.includes(name));

  return {
    valid: missing.length === 0 && failed.length === 0,
    missing,
    failed
  };
}

function runSupabaseMigrations(_projectName: string, env: string, supabaseCli: string): void {
  console.log(chalk.blue('\nℹ'), 'Applying database migrations...');

  // Check if migrations directory exists
  if (!existsSync('supabase/migrations')) {
    console.log(chalk.blue('ℹ'), 'No migrations found in supabase/migrations/');
    return;
  }

  try {
    // Get database password from .env
    const envPrefix = env.toUpperCase();
    const passwordKey = `${envPrefix}_POSTGRES_PASSWORD`;

    let password = 'postgres';
    if (existsSync('.env')) {
      const envContent = readFileSync('.env', 'utf-8');
      const match = envContent.match(new RegExp(`${passwordKey}=(.+)`));
      password = match?.[1]?.trim() || 'postgres';
    }

    // Build database URL
    const dbUrl = `postgresql://postgres:${password}@localhost:5432/postgres`;

    console.log(chalk.blue('ℹ'), `Running: ${supabaseCli} db push`);
    console.log(chalk.gray('  Database: localhost:5432'));

    // Run migrations using detected Supabase CLI command
    execSync(`${supabaseCli} db push --db-url "${dbUrl}"`, {
      stdio: 'inherit',
      env: { ...process.env }
    });

    console.log(chalk.green('✓'), 'Database migrations applied successfully\n');
  } catch (error) {
    console.log(chalk.yellow('\n!'), 'Failed to apply migrations');
    console.log(chalk.blue('ℹ'), 'You can apply them manually with:');
    console.log(chalk.cyan(`  ${supabaseCli} db push --db-url "postgresql://postgres:PASSWORD@localhost:5432/postgres"`));
    console.log(chalk.gray('  (Replace PASSWORD with ${env.toUpperCase()}_POSTGRES_PASSWORD from .env)\n'));
  }
}

function showRouterStatus(projectConfig: ReturnType<typeof getProjectConfig>, env: string): void {
  console.log('\n' + chalk.bold('Routing ready:'));

  // Get deployment config for domain resolution
  const deployment = projectConfig.deployments?.find(d => d.name === env);
  const appDomain = getAppDomain(deployment);

  // Show configured services with descriptions
  projectConfig.services.forEach(service => {
    const url = env === 'development'
      ? `https://${service.name}.lvh.me`
      : `https://${service.name}.${appDomain}`;
    const description = 'Your application';
    console.log(chalk.green('  ✓'), url, chalk.gray(`→ ${description}`));
  });

  // Show BaaS URLs with descriptions
  if (env === 'development') {
    const detectedServices = detectBaaSServices();
    if (detectedServices.includes('Supabase')) {
      console.log(chalk.green('  ✓'), 'https://api.lvh.me', chalk.gray('→ Supabase API'));
      console.log(chalk.green('  ✓'), 'https://studio.lvh.me', chalk.gray('→ Supabase Studio'));
    }
  } else {
    // For production environments, show self-hosted Supabase URLs
    const apiDomain = getApiDomain(deployment);
    const studioDomain = getStudioDomain(deployment);
    console.log(chalk.green('  ✓'), `https://${apiDomain}`, chalk.gray('→ Supabase API'));
    console.log(chalk.green('  ✓'), `https://${studioDomain}`, chalk.gray('→ Supabase Studio'));
  }

  // Show Traefik dashboard only in development
  if (env === 'development') {
    console.log(chalk.green('  ✓'), 'https://router.lvh.me', chalk.gray('→ Router dashboard'));
  }

  console.log('\n' + chalk.bold('Next steps:'));

  // Only show "Start your app" message in development mode
  // In deployment mode, the app is containerized and already running
  if (env === 'development') {
    console.log('  Start your app: ' + chalk.cyan(getDevCommand()));
  }

  console.log('\n' + chalk.bold('Manage Lightstack infrastructure:'));
  console.log('  Restart: ' + chalk.cyan('light restart'));
  console.log('  Stop:    ' + chalk.cyan('light down'));

  console.log('\n' + chalk.bold('Manage deployments:'));
  console.log('  Add deployment target: ' + chalk.cyan('light env add <name>'));
  console.log('');
}

function loadOrGenerateSecrets(env: string): { generated: boolean; secrets: Record<string, string> } {
  const envFile = '.env';
  const prefix = env.toUpperCase();

  // Required secret keys with environment prefix
  const requiredKeys = [
    `${prefix}_POSTGRES_PASSWORD`,
    `${prefix}_JWT_SECRET`,
    `${prefix}_ANON_KEY`,
    `${prefix}_SERVICE_KEY`,
    `${prefix}_VAULT_ENC_KEY`,
    `${prefix}_PG_META_CRYPTO_KEY`
  ];

  let envContent = '';
  const existingSecrets: Record<string, string> = {};

  // Load existing .env file
  if (existsSync(envFile)) {
    envContent = readFileSync(envFile, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }
      const [key, ...valueParts] = line.split('=');
      if (key?.trim()) {
        existingSecrets[key.trim()] = valueParts.join('=').trim();
      }
    });
  }

  // Check if all required secrets exist
  const allSecretsExist = requiredKeys.every(key => existingSecrets[key]);

  if (allSecretsExist) {
    return { generated: false, secrets: existingSecrets };
  }

  // Generate new secrets
  const secrets = generateSupabaseSecrets();
  const lines = envContent.split('\n');

  // Add section header if needed
  if (!envContent.includes(`# ${env.charAt(0).toUpperCase() + env.slice(1)} Supabase Secrets`)) {
    lines.push('');
    lines.push(`# ${env.charAt(0).toUpperCase() + env.slice(1)} Supabase Secrets`);
    lines.push(`# Auto-generated by Lightstack CLI`);
    lines.push(`# These secrets are loaded into .light/.env for Supabase services`);
  }

  // Add missing secrets and build the complete secrets object
  const completeSecrets: Record<string, string> = { ...existingSecrets };

  if (!existingSecrets[`${prefix}_POSTGRES_PASSWORD`]) {
    lines.push(`${prefix}_POSTGRES_PASSWORD=${secrets.postgresPassword}`);
    completeSecrets[`${prefix}_POSTGRES_PASSWORD`] = secrets.postgresPassword;
  }
  if (!existingSecrets[`${prefix}_JWT_SECRET`]) {
    lines.push(`${prefix}_JWT_SECRET=${secrets.jwtSecret}`);
    completeSecrets[`${prefix}_JWT_SECRET`] = secrets.jwtSecret;
  }
  if (!existingSecrets[`${prefix}_ANON_KEY`]) {
    lines.push(`${prefix}_ANON_KEY=${secrets.anonKey}`);
    completeSecrets[`${prefix}_ANON_KEY`] = secrets.anonKey;
  }
  if (!existingSecrets[`${prefix}_SERVICE_KEY`]) {
    lines.push(`${prefix}_SERVICE_KEY=${secrets.serviceKey}`);
    completeSecrets[`${prefix}_SERVICE_KEY`] = secrets.serviceKey;
  }
  if (!existingSecrets[`${prefix}_VAULT_ENC_KEY`]) {
    lines.push(`${prefix}_VAULT_ENC_KEY=${secrets.vaultEncKey}`);
    completeSecrets[`${prefix}_VAULT_ENC_KEY`] = secrets.vaultEncKey;
  }
  if (!existingSecrets[`${prefix}_PG_META_CRYPTO_KEY`]) {
    lines.push(`${prefix}_PG_META_CRYPTO_KEY=${secrets.pgMetaCryptoKey}`);
    completeSecrets[`${prefix}_PG_META_CRYPTO_KEY`] = secrets.pgMetaCryptoKey;
  }

  // Write back to .env
  writeFileSync(envFile, lines.join('\n'));

  return { generated: true, secrets: completeSecrets };
}