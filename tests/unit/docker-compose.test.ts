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
  traefik:
    image: traefik:v3.5
    container_name: \${PROJECT_NAME:-${project.name}}-proxy
    command:
      - --api.dashboard=true
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.watch=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./.light/traefik:/etc/traefik/dynamic:ro
    networks:
      - lightstack

networks:
  lightstack:
    driver: bridge
`;
}

function generateDevDockerCompose(): string {
  return `services:
  traefik:
    volumes:
      - ./.light/certs:/certs:ro
      - ./.light/traefik:/etc/traefik/dynamic:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.router.rule=Host(\`router.lvh.me\`)"
      - "traefik.http.routers.router.tls=true"
      - "traefik.http.routers.router.service=api@internal"
`;
}

function generateProdDockerCompose(project: ProjectConfig): string {
  return `services:
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

    it('should include Traefik service with correct configuration', () => {
      const traefik = composeConfig.services.traefik;

      expect(traefik).toBeDefined();
      expect(traefik.image).toBe('traefik:v3.5');
      expect(traefik.container_name).toBe('${PROJECT_NAME:-test-project}-proxy');

      // Check required command flags
      expect(traefik.command).toContain('--api.dashboard=true');
      expect(traefik.command).toContain('--providers.file.directory=/etc/traefik/dynamic');
      expect(traefik.command).toContain('--entrypoints.web.address=:80');
      expect(traefik.command).toContain('--entrypoints.websecure.address=:443');
    });

    it('should include correct port mappings for Traefik', () => {
      const traefik = composeConfig.services.traefik;

      expect(traefik.ports).toContain('80:80');
      expect(traefik.ports).toContain('443:443');
      expect(traefik.ports).toContain('8080:8080');
    });

    it('should include host.docker.internal for proxying to localhost', () => {
      const traefik = composeConfig.services.traefik;

      expect(traefik.extra_hosts).toContain('host.docker.internal:host-gateway');
    });

    it('should only include Traefik service (no app container)', () => {
      // Base compose only has Traefik - apps run on localhost
      expect(composeConfig.services.traefik).toBeDefined();
      expect(composeConfig.services.app).toBeUndefined();
    });

    it('should include lightstack network', () => {
      expect(composeConfig.networks.lightstack).toBeDefined();
      expect(composeConfig.networks.lightstack.driver).toBe('bridge');
    });

    it('should include file provider volumes', () => {
      const traefik = composeConfig.services.traefik;
      expect(traefik.volumes).toContain('./.light/traefik:/etc/traefik/dynamic:ro');
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
      expect(devConfig.services.traefik).toBeDefined();
    });

    it('should include development-specific volumes', () => {
      const traefik = devConfig.services.traefik;

      expect(traefik.volumes).toContain('./.light/certs:/certs:ro');
      expect(traefik.volumes).toContain('./.light/traefik:/etc/traefik/dynamic:ro');
    });

    it('should include router dashboard labels', () => {
      const traefik = devConfig.services.traefik;

      expect(traefik.labels).toContain('traefik.enable=true');
      expect(traefik.labels).toContain('traefik.http.routers.router.rule=Host(`router.lvh.me`)');
      expect(traefik.labels).toContain('traefik.http.routers.router.tls=true');
      expect(traefik.labels).toContain('traefik.http.routers.router.service=api@internal');
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
      expect(prodConfig.services.traefik).toBeDefined();
    });

    it('should disable API dashboard for production', () => {
      const traefik = prodConfig.services.traefik;

      expect(traefik.command).toContain('--api.dashboard=false');
    });

    it('should include Let\'s Encrypt configuration', () => {
      const traefik = prodConfig.services.traefik;

      expect(traefik.command).toContain('--certificatesresolvers.letsencrypt.acme.httpchallenge=true');
      expect(traefik.command).toContain('--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}');
      expect(traefik.command).toContain('--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json');
    });

    it('should enable Docker provider for production', () => {
      const traefik = prodConfig.services.traefik;

      expect(traefik.command).toContain('--providers.docker=true');
      expect(traefik.command).toContain('--providers.docker.exposedbydefault=false');
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

      expect(config.services.traefik.container_name).toBe('${PROJECT_NAME:-my-special-app}-proxy');
    });

    it('should handle empty services array gracefully', () => {
      const emptyProject: ProjectConfig = {
        name: 'empty-project',
        services: []
      };

      expect(() => generateBaseDockerCompose(emptyProject)).not.toThrow();

      const composeYaml = generateBaseDockerCompose(emptyProject);
      const config = yaml.load(composeYaml) as any;

      // Should still generate Traefik service
      expect(config.services.traefik).toBeDefined();
    });
  });
});