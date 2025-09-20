import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

interface UpOptions {
  env?: string;
  build?: boolean;
  detach?: boolean;
}

export function upCommand(options: UpOptions = {}) {
  try {
    const env = options.env || 'development';
    const build = options.build || false;
    const detach = options.detach !== false; // Default to true

    // Check prerequisites
    checkPrerequisites();

    // Check environment setup
    checkEnvironment(env);

    // Build Docker Compose command
    const composeFiles = getComposeFiles(env);
    const dockerCmd = buildDockerCommand(composeFiles, { build, detach });

    console.log(chalk.blue('🚀'), `Starting ${env} environment...`);

    if (build) {
      console.log(chalk.blue('🔨'), 'Building containers...');
    }

    // Execute Docker Compose
    execSync(dockerCmd, { stdio: 'inherit' });

    console.log(chalk.green('✓'), `${env} environment started`);

    if (env === 'development') {
      console.log('\nServices available at:');
      console.log('  https://app.lvh.me     # Main application');
      console.log('  https://traefik.lvh.me # Traefik dashboard');
    }

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
    warnings.push('No .env file found. Using default values.');
    warnings.push('Create a .env file to configure environment variables.');
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
  options: { build: boolean; detach: boolean }
): string {
  const fileArgs = composeFiles.map(f => `-f ${f}`).join(' ');
  const envFileArg = existsSync('.env') ? '--env-file ./.env' : '';
  const buildFlag = options.build ? '--build' : '';
  const detachFlag = options.detach ? '-d' : '';

  return `docker compose ${fileArgs} ${envFileArg} up ${buildFlag} ${detachFlag}`.trim();
}