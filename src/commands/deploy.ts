import { existsSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getProjectConfig, type DeploymentConfig } from '../utils/config.js';

interface DeployOptions {
  dryRun?: boolean;
  build?: boolean;
  rollback?: boolean;
}

export function deployCommand(environment: string, options: DeployOptions = {}) {
  try {
    const dryRun = options.dryRun || false;
    const build = options.build || false;
    const rollback = options.rollback || false;

    // Check if project is initialized
    if (!existsSync('light.config.yml') && !existsSync('light.config.yml')) {
      throw new Error('No Lightstack project found. Run "light init" first.');
    }

    // Check if Docker is available
    try {
      execSync('docker info', { stdio: 'ignore' });
    } catch {
      throw new Error('Docker is not running. Please start Docker Desktop and try again.');
    }

    // Load project config and validate environment
    const projectConfig = getProjectConfig();
    const validEnvironments = projectConfig.deployments?.map(d => d.name) || [];

    if (validEnvironments.length === 0) {
      throw new Error('No deployment environments configured. Run "light env add production" to add one.');
    }

    if (!validEnvironments.includes(environment)) {
      throw new Error(`Environment "${environment}" not found. Available environments: ${validEnvironments.join(', ')}\n\nAdd a new environment with: light env add ${environment}`);
    }

    // Get deployment configuration for this environment
    const deploymentConfig = projectConfig.deployments?.find(d => d.name === environment);
    if (!deploymentConfig) {
      throw new Error(`Environment "${environment}" configuration not found`);
    }

    if (rollback) {
      handleRollback(environment, dryRun);
      return;
    }

    console.log(chalk.blue('🚀'), `Deploying to ${environment} environment...`);
    console.log(chalk.gray(`Target: ${deploymentConfig.user || 'ubuntu'}@${deploymentConfig.host}:${deploymentConfig.port || 22}`));
    console.log(chalk.gray(`Domain: ${deploymentConfig.domain || 'Not configured'}`));

    if (dryRun) {
      console.log(chalk.yellow('⚠️'), 'DRY RUN MODE - No actual changes will be made');
      console.log();
    }

    // Deployment steps
    const steps = [
      { name: 'Validating configuration', fn: () => validateConfiguration(environment) },
      { name: 'Checking deployment target', fn: () => checkDeploymentTarget(environment, deploymentConfig) },
      { name: 'Building application', fn: () => buildApplication(build, dryRun) },
      { name: 'Creating deployment bundle', fn: () => createBundle(dryRun) },
      { name: 'Deploying to target', fn: () => deployToTarget(environment, deploymentConfig, dryRun) },
      { name: 'Running health checks', fn: () => runHealthChecks(environment, dryRun) },
    ];

    // Execute deployment steps
    for (const step of steps) {
      const spinner = ora(step.name).start();
      try {
        step.fn();
        spinner.succeed(step.name);
      } catch (error) {
        spinner.fail(`${step.name} - Failed`);
        throw error;
      }
    }

    if (dryRun) {
      console.log('\n' + chalk.yellow('🔍 Dry run complete. No changes were made.'));
      console.log('Remove --dry-run flag to perform actual deployment.');
    } else {
      console.log('\n' + chalk.green('✅ Deployment successful!'));
      console.log(`\nYour application is now live at ${environment}.`);
      console.log('Run "light status" to check service health.');
    }

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof Error) {
      console.log('\nCause: Deployment failed');
      console.log('Solution: Check the error message above and fix any issues');
      console.log('\nFor more help: light deploy --help');
    }

    process.exit(1);
  }
}

function validateConfiguration(environment: string): void {
  // Check for environment-specific config
  const envFile = `.env.${environment}`;
  if (!existsSync(envFile) && environment !== 'development') {
    console.log(chalk.yellow(`    Warning: ${envFile} not found. Using default configuration.`));
  }

  // Check Docker Compose files
  const composeFile = `.light/docker-compose.${environment}.yml`;
  if (!existsSync(composeFile)) {
    throw new Error(`Docker Compose file for ${environment} not found: ${composeFile}`);
  }
}

function checkDeploymentTarget(environment: string, deploymentConfig: DeploymentConfig): void {
  if (environment === 'development') {
    console.log(chalk.gray('    Skipping remote target check for local development'));
    return;
  }

  // In a real implementation, this would check SSH connectivity,
  // server requirements, etc.
  console.log(chalk.gray(`    SSH connectivity: ${deploymentConfig.user || 'ubuntu'}@${deploymentConfig.host}`));

  // TODO: Actual SSH connectivity check
  // execSync(`ssh -o ConnectTimeout=5 ${deploymentConfig.user || 'ubuntu'}@${deploymentConfig.host} "echo 'Connected'"`)
}

function buildApplication(forceBuild: boolean, dryRun: boolean): void {
  if (dryRun) {
    console.log(chalk.gray('    Would build: docker build -t app:latest .'));
    return;
  }

  if (!forceBuild) {
    // Check if image exists and is recent
    try {
      const imageInfo = execSync('docker images app:latest --format "{{.CreatedAt}}"', {
        encoding: 'utf-8'
      }).trim();

      if (imageInfo) {
        console.log(chalk.gray(`    Using existing image (created: ${imageInfo})`));
        return;
      }
    } catch {
      // Image doesn't exist, need to build
    }
  }

  execSync('docker build -t app:latest .', { stdio: 'pipe' });
}

function createBundle(dryRun: boolean): void {
  if (dryRun) {
    console.log(chalk.gray('    Would create deployment bundle with Docker Compose files'));
    return;
  }

  // In a real implementation, this would:
  // - Create a tarball of necessary files
  // - Include docker-compose files
  // - Include environment configs
  // - Exclude development files
}

function deployToTarget(environment: string, deploymentConfig: DeploymentConfig, dryRun: boolean): void {
  if (dryRun) {
    console.log(chalk.gray(`    Would deploy to ${deploymentConfig.host} using GitOps approach`));
    console.log(chalk.gray(`    - SSH to ${deploymentConfig.user || 'ubuntu'}@${deploymentConfig.host}`));
    console.log(chalk.gray(`    - Git pull latest changes`));
    console.log(chalk.gray(`    - Run: light up --env ${environment}`));
    return;
  }

  if (environment === 'development') {
    // Local deployment
    execSync('docker compose -f .light/docker-compose.yml -f .light/docker-compose.dev.yml up -d', {
      stdio: 'pipe'
    });
  } else {
    // Remote deployment using GitOps approach:
    // - SSH to target server
    // - Git pull/checkout
    // - Run light up --env production
    console.log(chalk.yellow('    GitOps deployment coming soon...'));
    throw new Error(`Remote deployment not yet implemented. Coming soon:

    1. SSH to ${deploymentConfig.host}
    2. Git checkout your tagged release
    3. Run "light up --env ${environment}" on the server

    For now, SSH to your server manually and run these commands.`);
  }
}

function runHealthChecks(environment: string, dryRun: boolean): void {
  if (dryRun) {
    console.log(chalk.gray('    Would run health checks on deployed services'));
    return;
  }

  // Basic health check
  try {
    if (environment === 'development') {
      // Check if containers are running
      const psOutput = execSync('docker compose -f .light/docker-compose.yml ps --format json', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      if (!psOutput || psOutput.trim() === '') {
        throw new Error('No containers running after deployment');
      }
    }
  } catch (error) {
    throw new Error('Health checks failed. Deployment may be incomplete.');
  }
}

function handleRollback(environment: string, dryRun: boolean): void {
  console.log(chalk.blue('↩️'), `Rolling back ${environment} deployment...`);

  if (dryRun) {
    console.log(chalk.yellow('⚠️'), 'DRY RUN MODE - No actual rollback will be performed');
    console.log();
    console.log('Would perform rollback steps:');
    console.log('  1. Stop current deployment');
    console.log('  2. Restore previous Docker images');
    console.log('  3. Restart services with previous configuration');
    console.log('  4. Verify rollback success');
  } else {
    throw new Error('Rollback functionality not yet implemented. Manual intervention required.');
  }
}