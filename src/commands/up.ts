import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { setupMkcert, generateTraefikTlsConfig } from '../utils/mkcert.js';
import { getProjectConfig } from '../utils/config.js';

interface UpOptions {
  env?: string;
  detach?: boolean;
}

export function upCommand(options: UpOptions = {}) {
  try {
    const env = options.env || 'development';
    const detach = options.detach !== false; // Default to true

    // Load project configuration
    const projectConfig = getProjectConfig();

    // Check prerequisites
    checkPrerequisites();

    // Check environment setup
    checkEnvironment(env);

    // Setup SSL certificates for development
    if (env === 'development') {
      setupLocalSsl();
    }

    // Generate BaaS proxy configs if needed
    generateBaaSProxyConfigs();

    // Build Docker Compose command
    const composeFiles = getComposeFiles(env);
    const dockerCmd = buildDockerCommand(composeFiles, { detach });

    console.log(chalk.blue('🚀'), `Starting local proxy...`);

    // Execute Docker Compose
    execSync(dockerCmd, { stdio: 'inherit' });

    console.log(chalk.green('✅'), 'Proxy started');

    console.log('\n' + chalk.bold('Ready to proxy:'));

    // Show configured services
    projectConfig.services.forEach(service => {
      const url = `https://${service.name}.lvh.me`;
      const localUrl = `localhost:${service.port}`;
      console.log(chalk.green('  ✓'), `${url.padEnd(25)} → ${localUrl}`);
    });

    // Show BaaS URLs if detected
    const detectedServices = detectBaaSServices();
    if (detectedServices.includes('Supabase')) {
      console.log(chalk.green('  ✓'), `${'https://api.lvh.me'.padEnd(25)} → localhost:54321`);
      console.log(chalk.green('  ✓'), `${'https://studio.lvh.me'.padEnd(25)} → localhost:54323`);
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
  if (!existsSync('light.config.yaml') && !existsSync('light.config.yml')) {
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

  // For production, missing critical vars should error
  if (env === 'production' && !existsSync('.env')) {
    throw new Error('Production environment requires a .env file with ACME_EMAIL for SSL certificates.');
  }
}

function getComposeFiles(env: string): string[] {
  const baseFile = '.light/docker-compose.yml';
  const envFile = `.light/docker-compose.${env}.yml`;

  const files = [baseFile];

  if (existsSync(envFile)) {
    files.push(envFile);
  }

  return files;
}

function buildDockerCommand(
  composeFiles: string[],
  options: { detach: boolean }
): string {
  const fileArgs = composeFiles.map(f => `-f ${f}`).join(' ');
  const envFileArg = existsSync('.env') ? '--env-file ./.env' : '';
  const detachFlag = options.detach ? '-d' : '';

  return `docker compose ${fileArgs} ${envFileArg} up ${detachFlag}`.trim();
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

function generateTraefikDynamicConfig(appServices: any[], baasServices: string[]): string {
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