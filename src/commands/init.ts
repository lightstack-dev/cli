import { writeFileSync, existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
import { basename } from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import type { ProjectConfig } from '../utils/config.js';

interface InitOptions {
  force?: boolean;
}

export function initCommand(projectName?: string, options: InitOptions = {}) {
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
    createDockerComposeFiles(project);

    // Update .gitignore
    updateGitignore();

    // Success message
    console.log(chalk.green('✅'), `Project '${name}' initialized`);
    console.log(chalk.green('✅'), 'Proxy configuration created');

    console.log('\n' + chalk.bold('Next steps:'));
    console.log('  1. Start the proxy:');
    console.log('     light up');
    console.log('');
    console.log('  2. Start your app:');
    console.log('     npm run dev');
    console.log('     # (or yarn dev, bun dev, etc.)');
    console.log('');
    console.log('  3. Access your app:');
    console.log('     https://app.lvh.me');
    console.log('     https://router.lvh.me  (routing management)');

    console.log('\n' + chalk.gray('Optional: Set up BaaS services (Supabase, etc.) to get automatic proxying'));

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

function isValidProjectName(name: string): boolean {
  // Simple validation for URL-safe names
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
}

function createDockerComposeFiles(project: ProjectConfig) {
  // Base docker-compose.yml - Only Traefik, no app containers
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
      - "8080:8080"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./traefik:/etc/traefik/dynamic:ro
    networks:
      - lightstack

networks:
  lightstack:
    driver: bridge
`;

  writeFileSync('.light/docker-compose.yml', baseCompose);

  // Development override (docker-compose.development.yml)
  const devCompose = `services:
  router:
    volumes:
      - ./traefik:/etc/traefik/dynamic:ro
      - ./certs:/certs:ro
`;

  writeFileSync('.light/docker-compose.development.yml', devCompose);

  // Production override (docker-compose.production.yml)
  const prodCompose = `services:
  router:
    command:
      - --api.dashboard=false
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.web.http.redirections.entryPoint.to=websecure
      - --entrypoints.web.http.redirections.entryPoint.scheme=https
      - --certificatesresolvers.letsencrypt.acme.dnschallenge=true
      - --certificatesresolvers.letsencrypt.acme.dnschallenge.provider=\${DNS_PROVIDER}
      - --certificatesresolvers.letsencrypt.acme.email=\${ACME_EMAIL}
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
    environment:
      - DNS_PROVIDER=\${DNS_PROVIDER}

  ${project.services[0]?.name || 'app'}:
    restart: unless-stopped
`;

  writeFileSync('.light/docker-compose.production.yml', prodCompose);
}

function updateGitignore() {
  const lightStackEntries = [
    '',
    '# Lightstack',
    '.light/certs/',
    '.light/traefik/',
    '.env'
  ];

  if (existsSync('.gitignore')) {
    // Read existing .gitignore
    const content = readFileSync('.gitignore', 'utf-8');

    // Check if Lightstack section already exists
    if (content.includes('# Lightstack')) {
      return; // Already configured
    }

    // Append Lightstack entries
    appendFileSync('.gitignore', '\n' + lightStackEntries.join('\n') + '\n');
  } else {
    // Create new .gitignore
    const gitignoreContent = lightStackEntries.join('\n') + '\n';
    writeFileSync('.gitignore', gitignoreContent);
  }
}

