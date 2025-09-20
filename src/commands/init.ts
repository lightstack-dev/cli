import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { basename } from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import type { Project } from '../models/index.js';

interface InitOptions {
  force?: boolean;
}

export function initCommand(projectName?: string, options: InitOptions = {}) {
  try {
    const name = projectName || basename(process.cwd());
    const force = options.force || false;

    // Validate project name
    if (!isValidProjectName(name)) {
      throw new Error(`Invalid project name: ${name}. Project names must be URL-safe.`);
    }

    // Check if project already exists
    if ((existsSync('light.config.yaml') || existsSync('light.config.yml')) && !force) {
      throw new Error('Project already exists. Use --force to overwrite.');
    }

    // Create project configuration
    const project: Project = {
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
    writeFileSync('light.config.yaml', yamlConfig);

    // Create basic Docker Compose files
    createDockerComposeFiles(project);

    // Success message
    console.log(chalk.green('✅'), `Project '${name}' initialized`);
    console.log(chalk.green('✅'), 'Docker Compose files generated');
    console.log(chalk.green('✅'), 'Certificate directories created');

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
  const baseCompose = `services:
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
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.proxy.rule=Host(\`proxy.lvh.me\`)"
      - "traefik.http.routers.proxy.tls=true"
      - "traefik.http.routers.proxy.service=api@internal"
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
  const devCompose = `services:
  traefik:
    volumes:
      - ./certs:/certs:ro
      - ./.light/traefik:/etc/traefik/dynamic:ro
    command:
      - --api.dashboard=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.watch=true

  ${project.services[0]?.name || 'app'}:
    volumes:
      - .:/app:cached
      - /app/node_modules
`;

  writeFileSync('.light/docker-compose.dev.yml', devCompose);

  // Production override
  const prodCompose = `services:
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
    restart: unless-stopped
`;

  writeFileSync('.light/docker-compose.prod.yml', prodCompose);
}

