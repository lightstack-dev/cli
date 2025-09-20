import { describe, it, expect, beforeEach } from 'vitest';
import yaml from 'js-yaml';

// Docker Compose generation logic extracted and simplified from init.ts
interface Project {
  name: string;
  services: Array<{
    name: string;
    type: string;
    port: number;
  }>;
}

function generateBaseDockerCompose(project: Project): string {
  return `services:
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

  app:
    build: .
    container_name: \${PROJECT_NAME:-${project.name}}-app
    environment:
      - NODE_ENV=development
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(\`app.lvh.me\`)"
      - "traefik.http.routers.app.tls=true"
      - "traefik.http.services.app.loadbalancer.server.port=${project.services[0]?.port || 3000}"
    volumes:
      - .:/app
      - /app/node_modules
    networks:
      - lightstack

networks:
  lightstack:
    driver: bridge`;
}

function generateDevDockerCompose(): string {
  return `services:
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
      - --serverstransport.insecureskipverify=true`;
}

function generateProdDockerCompose(): string {
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
      - --certificatesresolvers.letsencrypt.acme.storage=/acme/acme.json
    labels:
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
    volumes:
      - acme_data:/acme

volumes:
  acme_data:`;
}

describe('Docker Compose Generation', () => {
  const sampleProject: Project = {
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
      expect(traefik.image).toBe('traefik:v3.0');
      expect(traefik.container_name).toBe('${PROJECT_NAME:-test-project}-traefik');

      // Check required command flags
      expect(traefik.command).toContain('--api.dashboard=true');
      expect(traefik.command).toContain('--providers.docker=true');
      expect(traefik.command).toContain('--entrypoints.web.address=:80');
      expect(traefik.command).toContain('--entrypoints.websecure.address=:443');
    });

    it('should include correct port mappings for Traefik', () => {
      const traefik = composeConfig.services.traefik;

      expect(traefik.ports).toContain('80:80');
      expect(traefik.ports).toContain('443:443');
      expect(traefik.ports).toContain('8080:8080');
    });

    it('should include Traefik labels for proxy dashboard', () => {
      const traefik = composeConfig.services.traefik;

      expect(traefik.labels).toContain('traefik.enable=true');
      expect(traefik.labels).toContain('traefik.http.routers.proxy.rule=Host(`proxy.lvh.me`)');
      expect(traefik.labels).toContain('traefik.http.routers.proxy.tls=true');
    });

    it('should include app service with correct configuration', () => {
      const app = composeConfig.services.app;

      expect(app).toBeDefined();
      expect(app.build).toBe('.');
      expect(app.container_name).toBe('${PROJECT_NAME:-test-project}-app');
      expect(app.environment).toContain('NODE_ENV=development');
    });

    it('should include app service labels for Traefik routing', () => {
      const app = composeConfig.services.app;

      expect(app.labels).toContain('traefik.enable=true');
      expect(app.labels).toContain('traefik.http.routers.app.rule=Host(`app.lvh.me`)');
      expect(app.labels).toContain('traefik.http.routers.app.tls=true');
      expect(app.labels).toContain('traefik.http.services.app.loadbalancer.server.port=3000');
    });

    it('should use project service port in load balancer configuration', () => {
      const projectWithCustomPort: Project = {
        name: 'custom-port-app',
        services: [{ name: 'app', type: 'nuxt', port: 8080 }]
      };

      const composeYaml = generateBaseDockerCompose(projectWithCustomPort);
      const config = yaml.load(composeYaml) as any;

      expect(config.services.app.labels).toContain('traefik.http.services.app.loadbalancer.server.port=8080');
    });

    it('should include lightstack network', () => {
      expect(composeConfig.networks.lightstack).toBeDefined();
      expect(composeConfig.networks.lightstack.driver).toBe('bridge');
    });

    it('should connect services to lightstack network', () => {
      expect(composeConfig.services.traefik.networks).toContain('lightstack');
      expect(composeConfig.services.app.networks).toContain('lightstack');
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

      expect(traefik.volumes).toContain('./certs:/certs:ro');
      expect(traefik.volumes).toContain('./.light/traefik:/etc/traefik/dynamic:ro');
    });

    it('should include file provider configuration', () => {
      const traefik = devConfig.services.traefik;

      expect(traefik.command).toContain('--providers.file.directory=/etc/traefik/dynamic');
      expect(traefik.command).toContain('--serverstransport.insecureskipverify=true');
    });

    it('should keep API dashboard enabled for development', () => {
      const traefik = devConfig.services.traefik;

      expect(traefik.command).toContain('--api.dashboard=true');
    });
  });

  describe('production Docker Compose override', () => {
    let prodConfig: any;

    beforeEach(() => {
      const prodYaml = generateProdDockerCompose();
      prodConfig = yaml.load(prodYaml);
    });

    it('should generate valid YAML structure', () => {
      expect(prodConfig).toBeDefined();
      expect(prodConfig.services).toBeDefined();
      expect(prodConfig.services.traefik).toBeDefined();
      expect(prodConfig.volumes).toBeDefined();
    });

    it('should disable API dashboard for production', () => {
      const traefik = prodConfig.services.traefik;

      expect(traefik.command).toContain('--api.dashboard=false');
    });

    it('should include Let\'s Encrypt configuration', () => {
      const traefik = prodConfig.services.traefik;

      expect(traefik.command).toContain('--certificatesresolvers.letsencrypt.acme.httpchallenge=true');
      expect(traefik.command).toContain('--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}');
      expect(traefik.command).toContain('--certificatesresolvers.letsencrypt.acme.storage=/acme/acme.json');
    });

    it('should include certificate resolver in labels', () => {
      const traefik = prodConfig.services.traefik;

      expect(traefik.labels).toContain('traefik.http.routers.app.tls.certresolver=letsencrypt');
    });

    it('should include ACME volume configuration', () => {
      expect(prodConfig.volumes.acme_data).toBeDefined();
      expect(prodConfig.services.traefik.volumes).toContain('acme_data:/acme');
    });
  });

  describe('project name handling', () => {
    it('should handle project names with special characters in container names', () => {
      const specialProject: Project = {
        name: 'my-special-app',
        services: [{ name: 'app', type: 'nuxt', port: 3000 }]
      };

      const composeYaml = generateBaseDockerCompose(specialProject);
      const config = yaml.load(composeYaml) as any;

      expect(config.services.traefik.container_name).toBe('${PROJECT_NAME:-my-special-app}-traefik');
      expect(config.services.app.container_name).toBe('${PROJECT_NAME:-my-special-app}-app');
    });

    it('should handle empty services array gracefully', () => {
      const emptyProject: Project = {
        name: 'empty-project',
        services: []
      };

      expect(() => generateBaseDockerCompose(emptyProject)).not.toThrow();

      const composeYaml = generateBaseDockerCompose(emptyProject);
      const config = yaml.load(composeYaml) as any;

      // Should use default port when no services
      expect(config.services.app.labels).toContain('traefik.http.services.app.loadbalancer.server.port=3000');
    });
  });
});