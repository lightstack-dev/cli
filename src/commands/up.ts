import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { confirm } from '@inquirer/prompts';
import { setupMkcert, generateTraefikTlsConfig } from '../utils/mkcert.js';
import { getProjectConfig, type ServiceConfig } from '../utils/config.js';
import { generateSupabaseStack, generateKongConfig, generateSupabaseSecrets } from '../utils/supabase-stack.js';
import { getSupabasePorts } from '../utils/supabase-config.js';
import { getAcmeEmail } from '../utils/user-config.js';

interface UpOptions {
  env?: string;
  detach?: boolean;
}

export async function upCommand(options: UpOptions = {}) {
  try {
    const env = options.env || 'development';
    const detach = options.detach !== false; // Default to true

    // Load project configuration
    const projectConfig = getProjectConfig();

    // Check prerequisites
    checkPrerequisites();

    // Check if environment is configured for non-development
    if (env !== 'development') {
      const envExists = projectConfig.deployments?.some(d => d.name === env);
      if (!envExists) {
        console.log(chalk.yellow('⚠️'), `Environment '${env}' is not configured.`);

        const shouldConfigure = await confirm({
          message: `Would you like to configure the '${env}' environment now?`,
          default: true
        });

        if (shouldConfigure) {
          // Run light env add command
          console.log('\n' + chalk.blue('→'), 'Running:', chalk.cyan(`light env add ${env}`));
          const cliPath = process.argv[1] || 'light';
          const result = spawnSync('node', [cliPath, 'env', 'add', env], {
            stdio: 'inherit',
            shell: true
          });

          if (result.status !== 0) {
            throw new Error(`Failed to configure environment '${env}'`);
          }

          console.log('\n' + chalk.green('✅'), `Environment '${env}' configured. Now starting ${env} infrastructure...\n`);
        } else {
          console.log('\nTo configure later, run:', chalk.cyan(`light env add ${env}`));
          process.exit(0);
        }
      }
    }

    // Check environment setup
    checkEnvironment(env);

    // Setup SSL certificates for development
    console.log(chalk.blue('ℹ'), `Environment: ${env}`);
    console.log(); // Visual separation
    if (env === 'development') {
      setupLocalSsl();
      // Generate BaaS proxy configs for development (proxy to Supabase CLI)
      generateBaaSProxyConfigs();
    } else {
      console.log(chalk.blue('🚀'), 'Setting up production Supabase stack...');

      // Validate prerequisites for production Supabase deployment
      if (!existsSync('supabase')) {
        throw new Error(
          'No Supabase project found.\n\n' +
          'Production deployment requires a Supabase project.\n' +
          'See: https://supabase.com/docs/guides/local-development'
        );
      }

      // Check for Supabase CLI
      try {
        execSync('supabase --version', { stdio: 'ignore' });
      } catch {
        throw new Error(
          'Supabase CLI not installed.\n\n' +
          'Production deployment requires the Supabase CLI for migrations.\n' +
          'See: https://supabase.com/docs/guides/local-development'
        );
      }

      // Check if Supabase dev environment is running
      const supabaseDevRunning = checkSupabaseDevEnvironment();
      if (supabaseDevRunning) {
        console.log(chalk.yellow('⚠️'), 'Supabase development environment is running');
        console.log(chalk.yellow('   This conflicts with the production stack (ports, containers)\n'));

        const shouldStop = await confirm({
          message: 'Stop development environment and start production stack?',
          default: true
        });

        if (shouldStop) {
          console.log(chalk.blue('→'), 'Stopping development environment...');
          try {
            execSync('supabase stop', { stdio: 'inherit' });

            // Double-check all Supabase containers are stopped (supabase stop can be flaky)
            const remainingContainers = execSync('docker ps --filter "name=supabase_" --format "{{.Names}}"', {
              encoding: 'utf-8'
            }).trim();

            if (remainingContainers) {
              console.log(chalk.yellow('⚠️'), 'Some Supabase containers still running, force stopping...');
              execSync(`docker stop ${remainingContainers.split('\n').join(' ')}`, { stdio: 'ignore' });
            }
          } catch (error) {
            console.log(chalk.yellow('⚠️'), 'Error stopping Supabase, continuing anyway...');
          }
          console.log();
        } else {
          console.log('\nCancelled. To start production stack later:');
          console.log('  1. Stop dev:', chalk.cyan('supabase stop'));
          console.log('  2. Start prod:', chalk.cyan(`light up ${env}`));
          process.exit(0);
        }
      }

      // For non-development environments, generate full Supabase stack
      // Get ACME email from user config (stored in ~/.lightstack/config.yml)
      const sslEmail = getAcmeEmail();
      if (!sslEmail) {
        console.log(chalk.yellow('⚠️'), 'ACME email not configured');
        console.log(chalk.blue('ℹ'), 'Run', chalk.cyan('light init'), 'to configure ACME email for Let\'s Encrypt SSL');
        console.log('');
      }

      generateProductionStack(projectConfig, env, sslEmail);
    }

    // Check if infrastructure is already running
    const composeFiles = getComposeFiles(env);
    const expectedContainers = getExpectedContainers(projectConfig.name, composeFiles);
    const existingStatus = checkInfrastructureStatus(projectConfig.name, env);

    if (existingStatus.hasRunningContainers) {
      // Validate that all expected containers are running
      const validation = validateContainerStatus(expectedContainers, existingStatus);

      if (validation.valid) {
        console.log(chalk.green('✅'), `Lightstack infrastructure is already running (${env})`);
        // Show same helpful output as when starting fresh
        showRouterStatus(projectConfig, env);
        return;
      } else {
        console.log(chalk.yellow('⚠️'), 'Infrastructure is incomplete, restarting...');
        if (validation.missing.length > 0) {
          console.log(chalk.gray('  Missing:'), validation.missing.join(', '));
        }
        if (validation.failed.length > 0) {
          console.log(chalk.gray('  Failed:'), validation.failed.join(', '));
        }
      }
    }

    // Build Docker Compose command
    const dockerCmd = buildDockerCommand(composeFiles, { detach, projectName: projectConfig.name });

    console.log(chalk.blue('🚀'), 'Starting router...');

    // Execute Docker Compose with error handling
    try {
      execSync(dockerCmd, { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.yellow('\n⚠️'), 'Docker Compose encountered an issue during startup');
      console.log(chalk.blue('ℹ'), 'Checking container status...\n');

      // Check which containers are actually running
      const status = checkInfrastructureStatus(projectConfig.name, env);

      if (status.hasRunningContainers) {
        console.log(chalk.yellow('⚠️'), 'Some containers started successfully:');
        status.running.forEach(container => {
          console.log(chalk.green('  ✓'), container);
        });

        if (status.failed.length > 0) {
          console.log(chalk.yellow('\n⚠️'), 'Some containers failed to start:');
          status.failed.forEach(container => {
            console.log(chalk.red('  ✗'), container);
          });
        }

        console.log(chalk.blue('\n💡 Recovery options:'));
        console.log('  1. Try running the command again:', chalk.cyan(`light up ${env}`));
        console.log('  2. Check logs for failed containers:', chalk.cyan('light logs'));
        console.log('  3. Stop and restart:', chalk.cyan('light down && light up ' + env));

        // Don't exit with error if some containers are running
        return;
      } else {
        console.log(chalk.red('❌'), 'No containers are running');
        console.log(chalk.blue('\n💡 Try:'));
        console.log('  1. Check Docker Desktop is running');
        console.log('  2. Clean up and retry:', chalk.cyan('light down && light up ' + env));
        throw new Error('Failed to start containers');
      }
    }

    console.log(chalk.green('✅'), 'Router started');

    // Run database migrations for production Supabase stacks
    if (env !== 'development' && existsSync('supabase')) {
      runSupabaseMigrations(projectConfig.name, env);
    }

    showRouterStatus(projectConfig, env);

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

function checkPrerequisites() {
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
    console.log(chalk.blue('ℹ'), 'No .env file found. Using built-in defaults (PROJECT_NAME, APP_PORT=3000).');
    console.log(chalk.blue('ℹ'), 'Create a .env file only if you need custom environment variables.');
    console.log(); // Empty line for spacing
  }

  // Show warnings if any
  if (warnings.length > 0) {
    console.log(chalk.yellow('⚠️ Warning:'));
    warnings.forEach(warning => {
      console.log(chalk.yellow(`  ${warning}`));
    });
    console.log(); // Empty line for spacing
  }
}

function getComposeFiles(env: string): string[] {
  const baseFile = '.light/docker-compose.yml';
  const envFile = `.light/docker-compose.${env}.yml`;
  const supabaseFile = '.light/docker-compose.supabase.yml';

  const files = [baseFile];

  // Add Supabase stack for non-development environments
  if (env !== 'development' && existsSync(supabaseFile)) {
    files.push(supabaseFile);
  }

  if (existsSync(envFile)) {
    files.push(envFile);
  }

  return files;
}

function buildDockerCommand(
  composeFiles: string[],
  options: { detach: boolean; projectName: string }
): string {
  const fileArgs = composeFiles.map(f => `-f ${f}`).join(' ');
  const projectArg = `--project-name ${options.projectName}`;
  const envFileArg = existsSync('.env') ? '--env-file ./.env' : '';
  const detachFlag = options.detach ? '-d' : '';

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

  if (detectedBaaSServices.length > 0) {
    // More specific message for single service (currently only Supabase supported)
    if (detectedBaaSServices.includes('Supabase')) {
      console.log(chalk.blue('ℹ'), 'Supabase instance detected');
      console.log(); // Visual separation
    }
  }
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
    console.log(chalk.yellow('⚠️'), 'Running without SSL. Install mkcert for HTTPS support.');
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

function generateProductionStack(projectConfig: ReturnType<typeof getProjectConfig>, env: string, sslEmail?: string) {
  console.log(chalk.blue('🔧'), `Generating self-hosted Supabase stack for ${env}...`);

  // Get domain from deployment config
  const deployment = projectConfig.deployments?.find(d => d.name === env);
  const domain = deployment?.domain || 'local.lightstack.dev';

  // Check if Supabase stack already exists
  const supabaseComposePath = `.light/docker-compose.supabase.yml`;

  if (!existsSync(supabaseComposePath)) {
    // Check if production secrets already exist in .env
    const secrets = loadOrGenerateSecrets(env);

    // Generate Supabase stack (uses .env secrets via ${VAR} syntax)
    const supabaseStack = generateSupabaseStack({
      projectName: projectConfig.name,
      domain,
      environment: env,
      sslEmail
    });

    writeFileSync(supabaseComposePath, supabaseStack);

    // Generate Kong configuration
    mkdirSync('.light/volumes/api', { recursive: true });
    writeFileSync('.light/volumes/api/kong.yml', generateKongConfig());

    if (secrets.generated) {
      console.log(chalk.green('✅'), `Production secrets generated in .env`);
      console.log(chalk.blue('ℹ'), 'Secrets are stored locally and gitignored\n');
    } else {
      console.log(chalk.blue('ℹ'), 'Using existing production secrets from .env\n');
    }
  } else {
    console.log(chalk.blue('ℹ'), 'Using existing Supabase stack configuration');
  }

  // Create necessary directories
  mkdirSync('.light/volumes/db/data', { recursive: true });
  mkdirSync('.light/volumes/storage', { recursive: true });
  mkdirSync('.light/traefik', { recursive: true });

  // Generate Traefik dynamic config for production (no localhost proxying)
  const dynamicConfig = generateProductionTraefikConfig(projectConfig.services, domain);
  writeFileSync('.light/traefik/dynamic.yml', dynamicConfig);
}

function generateProductionTraefikConfig(appServices: ServiceConfig[], domain: string): string {
  const config: TraefikDynamicConfig = {
    http: {
      routers: {},
      services: {}
    }
  };

  // In production, app services run in containers, not localhost
  appServices.forEach(service => {
    const routerName = service.name;
    const serviceName = `${service.name}-service`;

    config.http.routers[routerName] = {
      rule: `Host(\`${service.name}.${domain}\`)`,
      service: serviceName,
      tls: true
    };

    // In production, these would be containerized services
    // For now, still proxy to localhost for testing
    config.http.services[serviceName] = {
      loadBalancer: {
        servers: [{ url: `http://host.docker.internal:${service.port}` }]
      }
    };
  });

  // Note: Supabase services (Kong, Studio) are configured via Docker labels
  // in the generated docker-compose.supabase.yml, not here

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
    console.log(chalk.yellow('⚠️'), 'Unable to check container status');
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
      `${projectName}-meta`        // Meta service
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

function runSupabaseMigrations(_projectName: string, env: string): void {
  console.log(chalk.blue('\n🗄️'), 'Applying database migrations...');

  // Check if migrations directory exists
  if (!existsSync('supabase/migrations')) {
    console.log(chalk.blue('ℹ'), 'No migrations found in supabase/migrations/');
    console.log(chalk.blue('ℹ'), 'Create your first migration with: supabase migration new initial_schema');
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

    console.log(chalk.blue('ℹ'), 'Running: supabase db push');
    console.log(chalk.gray('  Database: localhost:5432'));

    // Run migrations
    execSync(`supabase db push --db-url "${dbUrl}"`, {
      stdio: 'inherit',
      env: { ...process.env }
    });

    console.log(chalk.green('✅'), 'Database migrations applied successfully\n');
  } catch (error) {
    console.log(chalk.yellow('\n⚠️'), 'Failed to apply migrations');
    console.log(chalk.blue('💡'), 'You can apply them manually with:');
    console.log(chalk.cyan(`  supabase db push --db-url "postgresql://postgres:PASSWORD@localhost:5432/postgres"`));
    console.log(chalk.gray('  (Replace PASSWORD with ${env.toUpperCase()}_POSTGRES_PASSWORD from .env)\n'));
  }
}

function showRouterStatus(projectConfig: ReturnType<typeof getProjectConfig>, env: string): void {
  console.log('\n' + chalk.bold('Router ready:'));

  // Show configured services
  projectConfig.services.forEach(service => {
    const url = `https://${service.name}.lvh.me`;
    const localUrl = `localhost:${service.port}`;
    console.log(chalk.green('  ✓'), `${url.padEnd(25)} → ${localUrl}`);
  });

  // Show BaaS URLs
  if (env === 'development') {
    const detectedServices = detectBaaSServices();
    if (detectedServices.includes('Supabase')) {
      const supabasePorts = getSupabasePorts();
      console.log(chalk.green('  ✓'), `${'https://api.lvh.me'.padEnd(25)} → localhost:${supabasePorts.api}`);
      console.log(chalk.green('  ✓'), `${'https://studio.lvh.me'.padEnd(25)} → localhost:${supabasePorts.studio}`);
    }
  } else {
    // For production environments, show self-hosted Supabase URLs
    const deployment = projectConfig.deployments?.find(d => d.name === env);
    const domain = deployment?.domain || 'local.lightstack.dev';
    console.log(chalk.green('  ✓'), `https://api.${domain}`.padEnd(35) + ' → Kong API Gateway');
    console.log(chalk.green('  ✓'), `https://studio.${domain}`.padEnd(35) + ' → Supabase Studio');
  }

  console.log(chalk.green('  ✓'), `${'https://router.lvh.me'.padEnd(25)} → Traefik routing`);

  console.log('\n' + chalk.bold('Start your app with one of:'));
  console.log('  ' + chalk.cyan('npm run dev'));
  console.log('  ' + chalk.cyan('pnpm dev'));
  console.log('  ' + chalk.cyan('yarn dev'));
  console.log('  ' + chalk.cyan('bun dev'));

  console.log('\n' + chalk.bold('Manage router:'));
  console.log('  ' + chalk.gray('Restart: ') + chalk.cyan('light restart'));
  console.log('  ' + chalk.gray('Stop:    ') + chalk.cyan('light down'));
}

function checkSupabaseDevEnvironment(): boolean {
  try {
    // Check if Supabase CLI containers are running
    const output = execSync('docker ps --filter "name=supabase_" --format "{{.Names}}"', {
      encoding: 'utf-8'
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

function loadOrGenerateSecrets(env: string): { generated: boolean; secrets: Record<string, string> } {
  const envFile = '.env';
  const prefix = env.toUpperCase();

  // Required secret keys with environment prefix
  const requiredKeys = [
    `${prefix}_POSTGRES_PASSWORD`,
    `${prefix}_JWT_SECRET`,
    `${prefix}_ANON_KEY`,
    `${prefix}_SERVICE_KEY`
  ];

  let envContent = '';
  const existingSecrets: Record<string, string> = {};

  // Load existing .env file
  if (existsSync(envFile)) {
    envContent = readFileSync(envFile, 'utf-8');
    envContent.split('\n').forEach(line => {
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
  if (!envContent.includes(`# ${env} Supabase secrets`)) {
    lines.push('');
    lines.push(`# ${env} Supabase secrets (auto-generated)`);
  }

  // Add missing secrets
  if (!existingSecrets[`${prefix}_POSTGRES_PASSWORD`]) {
    lines.push(`${prefix}_POSTGRES_PASSWORD=${secrets.postgresPassword}`);
  }
  if (!existingSecrets[`${prefix}_JWT_SECRET`]) {
    lines.push(`${prefix}_JWT_SECRET=${secrets.jwtSecret}`);
  }
  if (!existingSecrets[`${prefix}_ANON_KEY`]) {
    lines.push(`${prefix}_ANON_KEY=${secrets.anonKey}`);
  }
  if (!existingSecrets[`${prefix}_SERVICE_KEY`]) {
    lines.push(`${prefix}_SERVICE_KEY=${secrets.serviceKey}`);
  }

  // Write back to .env
  writeFileSync(envFile, lines.join('\n'));

  return { generated: true, secrets: existingSecrets };
}