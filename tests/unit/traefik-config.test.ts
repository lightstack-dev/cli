import { describe, it, expect, beforeEach } from 'vitest';
import yaml from 'js-yaml';

// Traefik configuration generation logic extracted from up.ts
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

function generateTraefikDynamicConfig(services: string[]): string {
  const config: TraefikDynamicConfig = {
    http: {
      routers: {},
      services: {}
    }
  };

  services.forEach(service => {
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
        rule: 'Host(`db.lvh.me`)',
        service: 'supabase-studio',
        tls: true
      };
      config.http.services['supabase-studio'] = {
        loadBalancer: {
          servers: [{ url: 'http://host.docker.internal:54323' }]
        }
      };

      // Supabase Storage
      config.http.routers['supabase-storage'] = {
        rule: 'Host(`storage.lvh.me`)',
        service: 'supabase-storage',
        tls: true
      };
      config.http.services['supabase-storage'] = {
        loadBalancer: {
          servers: [{ url: 'http://host.docker.internal:54324' }]
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

describe('Traefik Dynamic Configuration Generation', () => {
  describe('empty configuration', () => {
    it('should generate empty config when no services provided', () => {
      const yamlConfig = generateTraefikDynamicConfig([]);
      const config = yaml.load(yamlConfig) as TraefikDynamicConfig;

      expect(config.http.routers).toEqual({});
      expect(config.http.services).toEqual({});
    });

    it('should generate valid YAML structure', () => {
      const yamlConfig = generateTraefikDynamicConfig([]);
      expect(() => yaml.load(yamlConfig)).not.toThrow();

      const config = yaml.load(yamlConfig) as TraefikDynamicConfig;
      expect(config.http).toBeDefined();
      expect(config.http.routers).toBeDefined();
      expect(config.http.services).toBeDefined();
    });
  });

  describe('Supabase configuration', () => {
    let config: TraefikDynamicConfig;

    beforeEach(() => {
      const yamlConfig = generateTraefikDynamicConfig(['Supabase']);
      config = yaml.load(yamlConfig) as TraefikDynamicConfig;
    });

    it('should generate Supabase API router', () => {
      expect(config.http.routers['supabase-api']).toBeDefined();
      expect(config.http.routers['supabase-api'].rule).toBe('Host(`api.lvh.me`)');
      expect(config.http.routers['supabase-api'].service).toBe('supabase-api');
      expect(config.http.routers['supabase-api'].tls).toBe(true);
    });

    it('should generate Supabase Studio router', () => {
      expect(config.http.routers['supabase-studio']).toBeDefined();
      expect(config.http.routers['supabase-studio'].rule).toBe('Host(`db.lvh.me`)');
      expect(config.http.routers['supabase-studio'].service).toBe('supabase-studio');
      expect(config.http.routers['supabase-studio'].tls).toBe(true);
    });

    it('should generate Supabase Storage router', () => {
      expect(config.http.routers['supabase-storage']).toBeDefined();
      expect(config.http.routers['supabase-storage'].rule).toBe('Host(`storage.lvh.me`)');
      expect(config.http.routers['supabase-storage'].service).toBe('supabase-storage');
      expect(config.http.routers['supabase-storage'].tls).toBe(true);
    });

    it('should generate Supabase API service', () => {
      expect(config.http.services['supabase-api']).toBeDefined();
      expect(config.http.services['supabase-api'].loadBalancer.servers).toHaveLength(1);
      expect(config.http.services['supabase-api'].loadBalancer.servers[0].url).toBe('http://host.docker.internal:54321');
    });

    it('should generate Supabase Studio service', () => {
      expect(config.http.services['supabase-studio']).toBeDefined();
      expect(config.http.services['supabase-studio'].loadBalancer.servers).toHaveLength(1);
      expect(config.http.services['supabase-studio'].loadBalancer.servers[0].url).toBe('http://host.docker.internal:54323');
    });

    it('should generate Supabase Storage service', () => {
      expect(config.http.services['supabase-storage']).toBeDefined();
      expect(config.http.services['supabase-storage'].loadBalancer.servers).toHaveLength(1);
      expect(config.http.services['supabase-storage'].loadBalancer.servers[0].url).toBe('http://host.docker.internal:54324');
    });

    it('should generate exactly 3 routers and 3 services for Supabase', () => {
      expect(Object.keys(config.http.routers)).toHaveLength(3);
      expect(Object.keys(config.http.services)).toHaveLength(3);
    });
  });

  describe('unknown services', () => {
    it('should ignore unknown services', () => {
      const yamlConfig = generateTraefikDynamicConfig(['UnknownService']);
      const config = yaml.load(yamlConfig) as TraefikDynamicConfig;

      expect(config.http.routers).toEqual({});
      expect(config.http.services).toEqual({});
    });

    it('should handle mixed known and unknown services', () => {
      const yamlConfig = generateTraefikDynamicConfig(['Supabase', 'UnknownService', 'AnotherUnknown']);
      const config = yaml.load(yamlConfig) as TraefikDynamicConfig;

      // Should only generate Supabase configs
      expect(Object.keys(config.http.routers)).toHaveLength(3);
      expect(Object.keys(config.http.services)).toHaveLength(3);
      expect(config.http.routers['supabase-api']).toBeDefined();
    });
  });

  describe('YAML output format', () => {
    it('should generate properly formatted YAML', () => {
      const yamlConfig = generateTraefikDynamicConfig(['Supabase']);

      // Should be valid YAML
      expect(() => yaml.load(yamlConfig)).not.toThrow();

      // Should contain expected structure markers
      expect(yamlConfig).toContain('http:');
      expect(yamlConfig).toContain('routers:');
      expect(yamlConfig).toContain('services:');
      expect(yamlConfig).toContain('supabase-api:');
      expect(yamlConfig).toContain('rule: Host(`api.lvh.me`)');
      expect(yamlConfig).toContain('tls: true');
    });

    it('should use consistent indentation', () => {
      const yamlConfig = generateTraefikDynamicConfig(['Supabase']);
      const lines = yamlConfig.split('\n');

      // Check that indentation is consistent (2 spaces)
      const indentedLines = lines.filter(line => line.startsWith('  '));
      expect(indentedLines.length).toBeGreaterThan(0);

      // Check for 4-space indentation at deeper levels
      const deepIndentedLines = lines.filter(line => line.startsWith('    '));
      expect(deepIndentedLines.length).toBeGreaterThan(0);
    });
  });

  describe('future BaaS services', () => {
    it('should be extensible for other BaaS services', () => {
      // This test documents that the function is designed to be extensible
      // When Firebase or other services are added, they would follow the same pattern

      const yamlConfig = generateTraefikDynamicConfig(['Supabase']);
      const config = yaml.load(yamlConfig) as TraefikDynamicConfig;

      // The structure should support adding more services
      expect(config.http).toBeDefined();
      expect(config.http.routers).toBeDefined();
      expect(config.http.services).toBeDefined();
    });
  });
});