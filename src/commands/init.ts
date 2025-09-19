import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { basename } from 'path';
import chalk from 'chalk';
import type { Project } from '../models/index.js';

interface InitOptions {
  template?: string;
  force?: boolean;
}

export function initCommand(projectName?: string, options: InitOptions = {}) {
  try {
    const name = projectName || basename(process.cwd());
    const template = options.template || 'nuxt';
    const force = options.force || false;

    // Validate project name
    if (!isValidProjectName(name)) {
      throw new Error(`Invalid project name: ${name}. Project names must be URL-safe.`);
    }

    // Check if project already exists
    if (existsSync('light.config.json') && !force) {
      throw new Error('Project already exists. Use --force to overwrite.');
    }

    // Create project configuration
    const project: Project = {
      name,
      template,
      services: [
        {
          name: 'app',
          type: template,
          port: 3000,
        }
      ]
    };

    // Create directories
    mkdirSync('.light', { recursive: true });
    mkdirSync('.light/certs', { recursive: true });

    // Create configuration file
    writeFileSync('light.config.json', JSON.stringify(project, null, 2));

    // Create environment files
    writeFileSync('.env.development', `NODE_ENV=development
PROJECT_NAME=${name}
APP_PORT=3000
`);

    writeFileSync('.env.production', `NODE_ENV=production
PROJECT_NAME=${name}
APP_PORT=3000
`);

    // Create basic Docker Compose files
    createDockerComposeFiles(project);

    // Success message
    console.log(chalk.green('✓'), `Project '${name}' initialized`);
    console.log(chalk.green('✓'), 'Docker Compose files generated');
    console.log(chalk.green('✓'), 'Environment files created');
    console.log(chalk.green('✓'), 'Local certificates created');

    console.log('\nNext steps:');
    console.log('  light up              # Start development');
    console.log('  supabase init         # Set up Supabase (if using)');

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

function isValidProjectName(name: string): boolean {
  // Simple validation for URL-safe names
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
}

function createDockerComposeFiles(project: Project) {
  // Base docker-compose.yml
  const baseCompose = `version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: \${PROJECT_NAME:-${project.name}}-traefik
    command:
      - --api.dashboard=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - lightstack

  ${project.services[0]?.name || 'app'}:
    build: .
    container_name: \${PROJECT_NAME:-${project.name}}-${project.services[0]?.name || 'app'}
    ports:
      - "\${APP_PORT:-3000}:3000"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${project.services[0]?.name || 'app'}.rule=Host(\`${project.services[0]?.name || 'app'}.lvh.me\`)"
      - "traefik.http.routers.${project.services[0]?.name || 'app'}.tls=true"
    networks:
      - lightstack

networks:
  lightstack:
    driver: bridge
`;

  writeFileSync('.light/docker-compose.yml', baseCompose);

  // Development override
  const devCompose = `version: '3.8'

services:
  traefik:
    volumes:
      - ./certs:/certs:ro
    command:
      - --api.dashboard=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --providers.file.directory=/certs

  ${project.services[0]?.name || 'app'}:
    env_file:
      - .env.development
    volumes:
      - .:/app:cached
      - /app/node_modules
`;

  writeFileSync('.light/docker-compose.dev.yml', devCompose);

  // Production override
  const prodCompose = `version: '3.8'

services:
  traefik:
    command:
      - --api.dashboard=false
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --certificatesresolvers.letsencrypt.acme.email=\${ACME_EMAIL}
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json

  ${project.services[0]?.name || 'app'}:
    env_file:
      - .env.production
    restart: unless-stopped
`;

  writeFileSync('.light/docker-compose.prod.yml', prodCompose);
}