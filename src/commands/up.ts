import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { confirm } from '@inquirer/prompts';
import { setupMkcert, generateTraefikTlsConfig } from '../utils/mkcert.js';
import { getProjectConfig, type ServiceConfig } from '../utils/config.js';
import { generateSupabaseStack, generateKongConfig, generateSupabaseEnvTemplate, generateSupabaseSecrets } from '../utils/supabase-stack.js';

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

          console.log('\n' + chalk.green('✅'), `Environment '${env}' configured. Now continuing with deployment...\n`);
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

      // For non-development environments, generate full Supabase stack
      generateProductionStack(projectConfig, env);
    }

    // Check if stack is already running
    const existingStatus = checkContainerStatus(projectConfig.name, env);
    if (existingStatus.hasRunningContainers) {
      // Check if all expected containers are healthy
      const allHealthy = existingStatus.running.length > 0 && existingStatus.failed.length === 0 && existingStatus.created.length === 0;

      if (allHealthy) {
        console.log(chalk.green('✅'), 'Stack is already running and healthy');
        console.log(chalk.blue('ℹ'), 'Use', chalk.cyan('light down && light up ' + env), 'to restart');
        return;
      } else {
        console.log(chalk.yellow('⚠️'), 'Some containers are unhealthy, restarting...');
      }
    }

    // Build Docker Compose command
    const composeFiles = getComposeFiles(env);
    const dockerCmd = buildDockerCommand(composeFiles, { detach, projectName: projectConfig.name });

    console.log(chalk.blue('🚀'), `Starting local proxy...`);

    // Execute Docker Compose with error handling
    try {
      execSync(dockerCmd, { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.yellow('\n⚠️'), 'Docker Compose encountered an issue during startup');
      console.log(chalk.blue('ℹ'), 'Checking container status...\n');

      // Check which containers are actually running
      const status = checkContainerStatus(projectConfig.name, env);

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

    console.log(chalk.green('✅'), 'Proxy started');

    // Run database migrations for production Supabase stacks
    if (env !== 'development' && existsSync('supabase')) {
      runSupabaseMigrations(projectConfig.name, env);
    }

    console.log('\n' + chalk.bold('Ready to proxy:'));

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
        console.log(chalk.green('  ✓'), `${'https://api.lvh.me'.padEnd(25)} → localhost:54321`);
        console.log(chalk.green('  ✓'), `${'https://studio.lvh.me'.padEnd(25)} → localhost:54323`);
      }
    } else {
      // For production environments, show self-hosted Supabase URLs
      const deployment = projectConfig.deployments?.find(d => d.name === env);
      const domain = deployment?.domain || 'local.lightstack.dev';
      console.log(chalk.green('  ✓'), `https://api.${domain}`.padEnd(35) + ' → Kong API Gateway');
      console.log(chalk.green('  ✓'), `https://studio.${domain}`.padEnd(35) + ' → Supabase Studio');
    }

    console.log(chalk.green('  ✓'), `${'https://router.lvh.me'.padEnd(25)} → Traefik routing`);

    console.log('\n' + chalk.bold('Start your app:'));
    console.log('  npm run dev');
    console.log('  yarn dev');
    console.log('  bun dev');

    console.log('\n' + chalk.gray('Stop proxy with: light down'));

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

  // Check if .env file exists
  if (!existsSync('.env')) {
    console.log(chalk.blue('ℹ'), 'No .env file found. Using built-in defaults (PROJECT_NAME, APP_PORT=3000).');
    console.log(chalk.blue('ℹ'), 'Create a .env file only if you need custom environment variables.');
    console.log(); // Empty line for spacing
  } else {
    // If .env exists, check for commonly needed variables
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

      // For production, check critical variables
      if (env === 'production') {
        if (!envVars.ACME_EMAIL) {
          warnings.push('ACME_EMAIL not set. Required for Let\'s Encrypt SSL certificates in production.');
        }
      }

      // Check for common application variables
      const commonVars = ['DATABASE_URL', 'SUPABASE_URL', 'API_KEY'];
      const missingVars = commonVars.filter(v => !envVars[v]);

      if (missingVars.length > 0) {
        // This is just informational, not an error
        console.log(chalk.yellow('ℹ'), `Note: Some common variables not found: ${missingVars.join(', ')}`);
      }
    } catch (error) {
      warnings.push('Could not parse .env file. Check for syntax errors.');
    }
  }

  // Show warnings if any
  if (warnings.length > 0) {
    console.log(chalk.yellow('⚠️ Warning:'));
    warnings.forEach(warning => {
      console.log(chalk.yellow(`  ${warning}`));
    });
    console.log(); // Empty line for spacing
  }

  // For remote production deployments (not local testing), we need ACME_EMAIL
  // But for local testing with local.lightstack.dev, we don't need Let's Encrypt
  const isLocalTesting = env === 'production' && process.cwd().includes('test-project');
  if (env === 'production' && !existsSync('.env') && !isLocalTesting) {
    console.log(chalk.yellow('⚠️'), 'Production deployment will require .env file with ACME_EMAIL for SSL certificates.');
    console.log(chalk.yellow('⚠️'), 'For local testing, this is not required.');
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
    console.log(chalk.blue('ℹ'), `BaaS services detected: ${detectedBaaSServices.join(', ')}`);
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

    console.log(chalk.green('✅'), 'SSL certificates configured for local development');
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
      // Supabase API
      config.http.routers['supabase-api'] = {
        rule: 'Host(`api.lvh.me`)',
        service: 'supabase-api',
        tls: true
      };
      config.http.services['supabase-api'] = {
        loadBalancer: {
          servers: [{ url: 'http://host.docker.internal:54321' }]
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
          servers: [{ url: 'http://host.docker.internal:54323' }]
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

function generateProductionStack(projectConfig: ReturnType<typeof getProjectConfig>, env: string) {
  console.log(chalk.blue('🔧'), `Generating self-hosted Supabase stack for ${env}...`);

  // Get domain from deployment config
  const deployment = projectConfig.deployments?.find(d => d.name === env);
  const domain = deployment?.domain || 'local.lightstack.dev';

  // Check if Supabase stack already exists
  const supabaseComposePath = `.light/docker-compose.supabase.yml`;

  if (!existsSync(supabaseComposePath)) {
    // Generate Supabase stack
    const supabaseStack = generateSupabaseStack({
      projectName: projectConfig.name,
      domain,
      environment: env,
      sslEmail: projectConfig.deployments?.find(d => d.name === env)?.ssl?.email
    });

    writeFileSync(supabaseComposePath, supabaseStack);

    // Generate Kong configuration
    mkdirSync('.light/volumes/api', { recursive: true });
    writeFileSync('.light/volumes/api/kong.yml', generateKongConfig());

    // Generate secrets file
    const secrets = generateSupabaseSecrets();
    const envTemplate = generateSupabaseEnvTemplate(secrets);
    writeFileSync('.light/.env.supabase', envTemplate);

    console.log(chalk.yellow('⚠️'), 'Generated Supabase stack with new secrets');
    console.log(chalk.yellow('⚠️'), chalk.bold('IMPORTANT: Save the secrets in .light/.env.supabase to a secure location!'));
    console.log(chalk.yellow('⚠️'), 'These secrets cannot be recovered if lost.\n');
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

function checkContainerStatus(projectName: string, _env: string): ContainerStatus {
  const status: ContainerStatus = {
    hasRunningContainers: false,
    running: [],
    failed: [],
    created: []
  };

  try {
    // Get container status for this project
    const output = execSync(
      `docker ps -a --filter "name=${projectName}" --format "{{.Names}}\t{{.Status}}"`,
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

function runSupabaseMigrations(_projectName: string, _env: string): void {
  console.log(chalk.blue('\n🗄️'), 'Applying database migrations...');

  // Check if migrations directory exists
  if (!existsSync('supabase/migrations')) {
    console.log(chalk.blue('ℹ'), 'No migrations found in supabase/migrations/');
    console.log(chalk.blue('ℹ'), 'Create your first migration with: supabase migration new initial_schema');
    return;
  }

  try {
    // Get database password from generated secrets
    const secretsFile = readFileSync('.light/.env.supabase', 'utf-8');
    const passwordMatch = secretsFile.match(/POSTGRES_PASSWORD=(.+)/);
    const password = passwordMatch?.[1] || 'postgres';

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
    console.log(chalk.gray('  (Replace PASSWORD with the value from .light/.env.supabase)\n'));
  }
}