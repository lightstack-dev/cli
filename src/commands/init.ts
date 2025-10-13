import { writeFileSync, existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import yaml from 'js-yaml';
import type { ProjectConfig } from '../utils/config.js';
import { getDevCommand, detectWorkspace } from '../utils/package-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InitOptions {
  force?: boolean;
}

export async function initCommand(projectName?: string, options: InitOptions = {}) {
  try {
    const name = projectName || basename(process.cwd());
    const force = options.force || false;

    // Validate project name
    if (!isValidProjectName(name)) {
      throw new Error(`Invalid project name "${name}". Project names must be lowercase alphanumeric with hyphens only.`);
    }

    // Check if project already exists
    if ((existsSync('light.config.yml') || existsSync('light.config.yml')) && !force) {
      throw new Error('Project already exists. Use --force to overwrite.');
    }

    // Create project configuration
    const project: ProjectConfig = {
      name,
      services: [
        {
          name: 'app',
          type: 'nuxt',
          port: 3000,
        }
      ]
    };

    // Create directories
    mkdirSync('.light', { recursive: true });
    mkdirSync('.light/certs', { recursive: true });

    // Create configuration file
    const yamlConfig = yaml.dump(project, {
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });
    writeFileSync('light.config.yml', yamlConfig);

    // Create basic Docker Compose files
    await createDockerComposeFiles(project);

    // Update .gitignore
    updateGitignore();

    // Success message
    console.log(chalk.green('✓'), `Lightstack project '${name}' initialized`);

    console.log('\n' + chalk.bold('Next steps:'));
    console.log('  Start Lightstack infrastructure: ' + chalk.cyan('light up'));
    console.log('  Start your app:                  ' + chalk.cyan(getDevCommand()));
    console.log('');

  } catch (error) {
    console.error(chalk.red('✗'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

function isValidProjectName(name: string): boolean {
  // Simple validation for URL-safe names
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
}

async function createDockerComposeFiles(project: ProjectConfig) {
  // Base docker-compose.yml - Only Traefik, no app containers
  // Note: No explicit network definition - uses Docker Compose default network
  // Default network is automatically named ${project-name}_default
  const baseCompose = `services:
  router:
    image: traefik:v3.5
    container_name: \${PROJECT_NAME:-${project.name}}-router
    command:
      - --api.dashboard=true
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.filename=/etc/traefik/dynamic/tls.yml
      - --providers.file.watch=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.web.http.redirections.entryPoint.to=websecure
      - --entrypoints.web.http.redirections.entryPoint.scheme=https
    ports:
      - "80:80"
      - "443:443"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./traefik:/etc/traefik/dynamic:ro
`;

  writeFileSync('.light/docker-compose.yml', baseCompose);

  // Development override (docker-compose.development.yml)
  const devCompose = `services:
  router:
    ports:
      - "8080:8080"  # Traefik dashboard (development only)
    volumes:
      - ./traefik:/etc/traefik/dynamic:ro
      - ./certs:/certs:ro
`;

  writeFileSync('.light/docker-compose.development.yml', devCompose);

  // T026: Deployment override (docker-compose.deployment.yml) - renamed from production.yml
  // Check if Supabase project exists
  const hasSupabase = existsSync('supabase/config.toml');

  let deploymentCompose = '';

  // Copy official Supabase stack if Supabase project detected
  if (hasSupabase) {
    // Compute absolute path to bundled Supabase templates
    // In development: cli/src/commands/init.ts -> cli/templates/supabase
    // In production: cli/dist/commands/init.js -> cli/dist/templates/supabase
    const templateDir = join(__dirname, '..', '..', 'templates', 'supabase');
    const targetDir = '.light/supabase';

    // Copy Supabase template files to project
    const { copyDirectory } = await import('../utils/files.js');
    copyDirectory(templateDir, targetDir);

    deploymentCompose += `# Include official Supabase self-hosted stack
# Source: https://github.com/supabase/supabase/tree/master/docker
# Bundled template files copied to .light/supabase/
# Environment variables are loaded from project root .env via --env-file flag
include:
  - path: supabase/docker-compose.yml

`;
  }

  deploymentCompose += `services:
  router:
    command:
      - --api.dashboard=false
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.watch=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.web.http.redirections.entryPoint.to=websecure
      - --entrypoints.web.http.redirections.entryPoint.scheme=https
      # Note: For local deployment testing, SSL certs are in file provider
      # For remote deployment, add Let's Encrypt configuration via environment-specific overrides
    volumes:
      - ./traefik:/etc/traefik/dynamic:ro
      - ./certs:/certs:ro
`;

  // T027: Add app service definition to deployment compose file
  // Detect if this is a workspace project
  // Note: Context is relative to .light/ directory where compose files live
  // For standalone: context . = project root
  // For workspace: context ../.. = workspace root (up from .light/ to project, then to workspace)
  const workspaceInfo = detectWorkspace();
  const buildContext = workspaceInfo.isWorkspace ? '../..' : '..';
  const dockerfilePath = workspaceInfo.isWorkspace ? `${workspaceInfo.subdirName}/Dockerfile` : 'Dockerfile';

  deploymentCompose += `
  # Application container (deployment mode only)
  app:
    build:
      context: ${buildContext}
      dockerfile: ${dockerfilePath}
    container_name: \${PROJECT_NAME:-${project.name}}-app
    environment:
      - NODE_ENV=production
    labels:
      - traefik.enable=true
      - traefik.http.routers.app.rule=Host(\`app.\${DOMAIN:-local.lightstack.dev}\`)
      - traefik.http.routers.app.tls=true
      - traefik.http.services.app.loadbalancer.server.port=3000
`;

  // Add default network configuration for Supabase services
  // Use project-specific network name to avoid collisions between projects
  if (hasSupabase) {
    deploymentCompose += `
# Override default network name to be project-specific
# This prevents collisions when running multiple Lightstack projects
networks:
  default:
    name: ${project.name}_lightstack
`;
  }

  writeFileSync('.light/docker-compose.deployment.yml', deploymentCompose);

  // Create a separate override file for Supabase service customization
  // This must be a separate file because Docker Compose include doesn't allow service overrides
  if (hasSupabase) {
    const projectName = project.name;
    const supabaseOverrides = `# Supabase Service Overrides
# Customizes Supabase services for Lightstack integration
# - Adds Traefik labels for external access
# - Overrides container names to use project prefix
# - Extends healthcheck timeout for database initialization (Windows/WSL compatibility)
# - Loads Supabase environment variables from .light/.env (generated at runtime)
# This file is loaded AFTER the included Supabase stack

services:
  db:
    container_name: ${projectName}-db
    # Override healthcheck to allow more time for first initialization
    # Official stack: interval 5s, retries 10 = 60s max
    # Our override: interval 5s, retries 20 = 120s max
    # Database initialization with migrations takes 60-90s on Windows/WSL
    healthcheck:
      test: pg_isready -U postgres -h localhost
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 10s

  kong:
    container_name: ${projectName}-kong
    labels:
      - traefik.enable=true
      - traefik.http.routers.kong.rule=Host(\`api.\${DOMAIN:-local.lightstack.dev}\`)
      - traefik.http.routers.kong.tls=true
      - traefik.http.services.kong.loadbalancer.server.port=8000

  auth:
    container_name: ${projectName}-auth

  rest:
    container_name: ${projectName}-rest

  realtime:
    container_name: ${projectName}-realtime

  storage:
    container_name: ${projectName}-storage

  studio:
    container_name: ${projectName}-studio
    labels:
      - traefik.enable=true
      - traefik.http.routers.studio.rule=Host(\`studio.\${DOMAIN:-local.lightstack.dev}\`)
      - traefik.http.routers.studio.tls=true
      - traefik.http.services.studio.loadbalancer.server.port=3000

  meta:
    container_name: ${projectName}-meta

  imgproxy:
    container_name: ${projectName}-imgproxy

  functions:
    container_name: ${projectName}-functions

  analytics:
    container_name: ${projectName}-analytics

  vector:
    container_name: ${projectName}-vector

  supavisor:
    container_name: ${projectName}-supavisor
`;

    writeFileSync('.light/docker-compose.supabase-overrides.yml', supabaseOverrides);
  }
}

function updateGitignore() {
  const lightStackEntries = [
    '',
    '# Lightstack',
    '# Infrastructure files are committed for GitOps deployment',
    '# Only runtime/local files are ignored:',
    '.light/.env',             // Generated Supabase env vars (contains secrets)
    '.light/certs/',           // mkcert dev certificates
    '.light/volumes/',         // Runtime data (database, storage)
    '.light/traefik/tls.yml',  // mkcert TLS config (dev only)
    '.env'                     // User's environment secrets (never commit!)
  ];

  if (existsSync('.gitignore')) {
    // Read existing .gitignore
    let content = readFileSync('.gitignore', 'utf-8');

    // Check if Lightstack section already exists
    if (content.includes('# Lightstack')) {
      // Update existing section if it has the old blanket ignore
      if (content.includes('.light/') && !content.includes('.light/certs/')) {
        // Replace old blanket ignore with selective ignores
        content = content.replace(
          /# Lightstack\n\.light\/.*?\n/s,
          lightStackEntries.join('\n') + '\n'
        );
        writeFileSync('.gitignore', content);
      }
      return; // Already configured (correct version)
    }

    // Append Lightstack entries
    appendFileSync('.gitignore', '\n' + lightStackEntries.join('\n') + '\n');
  } else {
    // Create new .gitignore
    const gitignoreContent = lightStackEntries.join('\n') + '\n';
    writeFileSync('.gitignore', gitignoreContent);
  }
}

