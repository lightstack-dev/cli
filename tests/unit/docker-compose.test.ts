import { describe, it, expect, beforeEach } from 'vitest';
import yaml from 'js-yaml';

// Docker Compose generation logic matching current init.ts implementation
interface ProjectConfig {
  name: string;
  services: Array<{
    name: string;
    type: string;
    port: number;
  }>;
}

function generateBaseDockerCompose(project: ProjectConfig): string {
  return `services:
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
}

function generateDevDockerCompose(): string {
  return `services:
  router:
    volumes:
      - ./traefik:/etc/traefik/dynamic:ro
      - ./certs:/certs:ro
`;
}

function generateProdDockerCompose(project: ProjectConfig): string {
  return `services:
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
}

describe('Docker Compose Generation', () => {
  const sampleProject: ProjectConfig = {
    name: 'test-project',
    services: [
      {
        name: 'app',
        type: 'nuxt',
        port: 3000
      }
    ]
  };

  describe('base Docker Compose file', () => {
    let composeConfig: any;

    beforeEach(() => {
      const composeYaml = generateBaseDockerCompose(sampleProject);
      composeConfig = yaml.load(composeYaml);
    });

    it('should generate valid YAML structure', () => {
      expect(composeConfig).toBeDefined();
      expect(composeConfig.services).toBeDefined();
      expect(composeConfig.networks).toBeDefined();
    });

    it('should include router service with correct configuration', () => {
      const router = composeConfig.services.router;

      expect(router).toBeDefined();
      expect(router.image).toBe('traefik:v3.5');
      expect(router.container_name).toBe('${PROJECT_NAME:-test-project}-router');

      // Check required command flags
      expect(router.command).toContain('--api.dashboard=true');
      expect(router.command).toContain('--providers.file.directory=/etc/traefik/dynamic');
      expect(router.command).toContain('--providers.file.filename=/etc/traefik/dynamic/tls.yml');
      expect(router.command).toContain('--entrypoints.web.address=:80');
      expect(router.command).toContain('--entrypoints.websecure.address=:443');
      expect(router.command).toContain('--entrypoints.web.http.redirections.entryPoint.to=websecure');
      expect(router.command).toContain('--entrypoints.web.http.redirections.entryPoint.scheme=https');
    });

    it('should include correct port mappings for router', () => {
      const router = composeConfig.services.router;

      expect(router.ports).toContain('80:80');
      expect(router.ports).toContain('443:443');
      expect(router.ports).toContain('8080:8080');
    });

    it('should include host.docker.internal for proxying to localhost', () => {
      const router = composeConfig.services.router;

      expect(router.extra_hosts).toContain('host.docker.internal:host-gateway');
    });

    it('should only include router service (no app container)', () => {
      // Base compose only has router - apps run on localhost
      expect(composeConfig.services.router).toBeDefined();
      expect(composeConfig.services.app).toBeUndefined();
    });

    it('should include lightstack network', () => {
      expect(composeConfig.networks.lightstack).toBeDefined();
      expect(composeConfig.networks.lightstack.driver).toBe('bridge');
    });

    it('should include file provider volumes', () => {
      const router = composeConfig.services.router;
      expect(router.volumes).toContain('./traefik:/etc/traefik/dynamic:ro');
    });

    it('should not include version attribute', () => {
      const composeYaml = generateBaseDockerCompose(sampleProject);
      expect(composeYaml).not.toContain('version:');
    });
  });

  describe('development Docker Compose override', () => {
    let devConfig: any;

    beforeEach(() => {
      const devYaml = generateDevDockerCompose();
      devConfig = yaml.load(devYaml);
    });

    it('should generate valid YAML structure', () => {
      expect(devConfig).toBeDefined();
      expect(devConfig.services).toBeDefined();
      expect(devConfig.services.router).toBeDefined();
    });

    it('should include development-specific volumes', () => {
      const router = devConfig.services.router;

      expect(router.volumes).toContain('./traefik:/etc/traefik/dynamic:ro');
      expect(router.volumes).toContain('./certs:/certs:ro');
    });
  });

  describe('production Docker Compose override', () => {
    let prodConfig: any;

    beforeEach(() => {
      const prodYaml = generateProdDockerCompose(sampleProject);
      prodConfig = yaml.load(prodYaml);
    });

    it('should generate valid YAML structure', () => {
      expect(prodConfig).toBeDefined();
      expect(prodConfig.services).toBeDefined();
      expect(prodConfig.services.router).toBeDefined();
    });

    it('should disable API dashboard for production', () => {
      const router = prodConfig.services.router;

      expect(router.command).toContain('--api.dashboard=false');
    });

    it('should include HTTP to HTTPS redirect', () => {
      const router = prodConfig.services.router;

      expect(router.command).toContain('--entrypoints.web.http.redirections.entryPoint.to=websecure');
      expect(router.command).toContain('--entrypoints.web.http.redirections.entryPoint.scheme=https');
    });

    it('should include Let\'s Encrypt DNS challenge configuration', () => {
      const router = prodConfig.services.router;

      expect(router.command).toContain('--certificatesresolvers.letsencrypt.acme.dnschallenge=true');
      expect(router.command).toContain('--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=${DNS_PROVIDER}');
      expect(router.command).toContain('--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}');
      expect(router.command).toContain('--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json');

      expect(router.environment).toBeDefined();
      expect(router.environment).toContain('DNS_PROVIDER=${DNS_PROVIDER}');
    });

    it('should enable Docker provider for production', () => {
      const router = prodConfig.services.router;

      expect(router.command).toContain('--providers.docker=true');
      expect(router.command).toContain('--providers.docker.exposedbydefault=false');
    });

    it('should include app service with restart policy', () => {
      const app = prodConfig.services.app;

      expect(app).toBeDefined();
      expect(app.restart).toBe('unless-stopped');
    });

    it('should use first service name from project config', () => {
      const customProject: ProjectConfig = {
        name: 'my-app',
        services: [{ name: 'frontend', type: 'nuxt', port: 3000 }]
      };

      const prodYaml = generateProdDockerCompose(customProject);
      const config = yaml.load(prodYaml) as any;

      expect(config.services.frontend).toBeDefined();
    });
  });

  describe('project name handling', () => {
    it('should handle project names with hyphens in container names', () => {
      const specialProject: ProjectConfig = {
        name: 'my-special-app',
        services: [{ name: 'app', type: 'nuxt', port: 3000 }]
      };

      const composeYaml = generateBaseDockerCompose(specialProject);
      const config = yaml.load(composeYaml) as any;

      expect(config.services.router.container_name).toBe('${PROJECT_NAME:-my-special-app}-router');
    });

    it('should handle empty services array gracefully', () => {
      const emptyProject: ProjectConfig = {
        name: 'empty-project',
        services: []
      };

      expect(() => generateBaseDockerCompose(emptyProject)).not.toThrow();

      const composeYaml = generateBaseDockerCompose(emptyProject);
      const config = yaml.load(composeYaml) as any;

      // Should still generate router service
      expect(config.services.router).toBeDefined();
    });
  });
});