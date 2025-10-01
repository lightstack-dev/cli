import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { generateSupabaseStack, generateKongConfig, generateSupabaseSecrets, generateSupabaseEnvTemplate } from '../../src/utils/supabase-stack.js';

describe('Supabase Stack Generation', () => {
  describe('generateSupabaseSecrets', () => {
    it('should generate all required secrets', () => {
      const secrets = generateSupabaseSecrets();

      expect(secrets).toHaveProperty('postgresPassword');
      expect(secrets).toHaveProperty('jwtSecret');
      expect(secrets).toHaveProperty('anonKey');
      expect(secrets).toHaveProperty('serviceKey');
    });

    it('should generate unique secrets each time', () => {
      const secrets1 = generateSupabaseSecrets();
      const secrets2 = generateSupabaseSecrets();

      expect(secrets1.postgresPassword).not.toBe(secrets2.postgresPassword);
      expect(secrets1.jwtSecret).not.toBe(secrets2.jwtSecret);
      expect(secrets1.anonKey).not.toBe(secrets2.anonKey);
      expect(secrets1.serviceKey).not.toBe(secrets2.serviceKey);
    });

    it('should generate non-empty secrets', () => {
      const secrets = generateSupabaseSecrets();

      expect(secrets.postgresPassword.length).toBeGreaterThan(20);
      expect(secrets.jwtSecret.length).toBeGreaterThan(20);
      expect(secrets.anonKey.length).toBeGreaterThan(20);
      expect(secrets.serviceKey.length).toBeGreaterThan(20);
    });
  });

  describe('generateSupabaseStack', () => {
    const config = {
      projectName: 'test-project',
      domain: 'example.com',
      environment: 'production',
      sslEmail: 'test@example.com'
    };

    it('should generate valid YAML', () => {
      const stack = generateSupabaseStack(config);
      expect(() => yaml.load(stack)).not.toThrow();
    });

    it('should include all required Supabase services', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      // Verify all 8 services exist
      expect(parsed.services.db).toBeDefined();
      expect(parsed.services.kong).toBeDefined();
      expect(parsed.services.auth).toBeDefined();
      expect(parsed.services.rest).toBeDefined();
      expect(parsed.services.realtime).toBeDefined();
      expect(parsed.services.storage).toBeDefined();
      expect(parsed.services.studio).toBeDefined();
      expect(parsed.services.meta).toBeDefined();
    });

    it('should use project name in container names', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      expect(parsed.services.db.container_name).toBe('test-project-db');
      expect(parsed.services.kong.container_name).toBe('test-project-kong');
      expect(parsed.services.studio.container_name).toBe('test-project-studio');
    });

    it('should configure PostgreSQL with health check', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      expect(parsed.services.db.image).toContain('supabase/postgres');
      expect(parsed.services.db.healthcheck).toBeDefined();
      expect(Array.isArray(parsed.services.db.healthcheck.test)).toBe(true);
      expect(parsed.services.db.healthcheck.test.join(' ')).toContain('pg_isready');
    });

    it('should configure persistent volumes for database', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      expect(parsed.services.db.volumes).toBeDefined();
      expect(parsed.services.db.volumes.some((v: string) => v.includes('/var/lib/postgresql/data'))).toBe(true);
    });

    it('should configure Traefik labels for Kong API', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      expect(parsed.services.kong.labels).toBeDefined();
      expect(parsed.services.kong.labels.some((l: string) => l.includes('traefik.enable=true'))).toBe(true);
      expect(parsed.services.kong.labels.some((l: string) => l.includes(`api.${config.domain}`))).toBe(true);
    });

    it('should configure Traefik labels for Studio', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      expect(parsed.services.studio.labels).toBeDefined();
      expect(parsed.services.studio.labels.some((l: string) => l.includes('traefik.enable=true'))).toBe(true);
      expect(parsed.services.studio.labels.some((l: string) => l.includes(`studio.${config.domain}`))).toBe(true);
    });

    it('should configure service dependencies', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      // Kong depends on db
      expect(parsed.services.kong.depends_on).toBeDefined();
      expect(parsed.services.kong.depends_on.db).toBeDefined();

      // Auth depends on db
      expect(parsed.services.auth.depends_on).toBeDefined();
      expect(parsed.services.auth.depends_on.db).toBeDefined();
    });

    it('should use local.lightstack.dev for local production testing', () => {
      const localConfig = {
        projectName: 'test-project',
        domain: 'local.lightstack.dev',
        environment: 'production'
      };

      const stack = generateSupabaseStack(localConfig);
      expect(stack).toContain('local.lightstack.dev');
      // Should not include Let's Encrypt cert resolver for local testing
      expect(stack).not.toContain('certresolver=letsencrypt');
    });

    it('should include Let\'s Encrypt cert resolver for remote domains', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      // Kong should have cert resolver label
      expect(parsed.services.kong.labels.some((l: string) => l.includes('certresolver=letsencrypt'))).toBe(true);
    });

    it('should configure all services on lightstack network', () => {
      const stack = generateSupabaseStack(config);
      const parsed = yaml.load(stack) as any;

      expect(parsed.services.db.networks).toContain('lightstack');
      expect(parsed.services.kong.networks).toContain('lightstack');
      expect(parsed.services.auth.networks).toContain('lightstack');
      expect(parsed.services.rest.networks).toContain('lightstack');
      expect(parsed.services.studio.networks).toContain('lightstack');
    });
  });

  describe('generateKongConfig', () => {
    it('should generate valid YAML', () => {
      const config = generateKongConfig();
      expect(() => yaml.load(config)).not.toThrow();
    });

    it('should define all required Supabase API routes', () => {
      const config = generateKongConfig();
      const parsed = yaml.load(config) as any;

      expect(parsed.services).toBeDefined();
      expect(parsed.services.length).toBeGreaterThan(0);

      // Check for key services
      const serviceNames = parsed.services.map((s: any) => s.name);
      expect(serviceNames).toContain('rest-v1');
      expect(serviceNames).toContain('realtime-v1');
      expect(serviceNames).toContain('storage-v1');
    });

    it('should configure CORS plugin', () => {
      const config = generateKongConfig();
      const parsed = yaml.load(config) as any;

      const corsPlugin = parsed.plugins?.find((p: any) => p.name === 'cors');
      expect(corsPlugin).toBeDefined();
      expect(corsPlugin.config.origins).toContain('*');
      expect(corsPlugin.config.credentials).toBe(true);
    });

    it('should configure key-auth plugin', () => {
      const config = generateKongConfig();
      const parsed = yaml.load(config) as any;

      const keyAuthPlugin = parsed.plugins?.find((p: any) => p.name === 'key-auth');
      expect(keyAuthPlugin).toBeDefined();
      expect(keyAuthPlugin.config.key_names).toContain('apikey');
    });

    it('should map REST API to correct upstream', () => {
      const config = generateKongConfig();
      const parsed = yaml.load(config) as any;

      const restService = parsed.services.find((s: any) => s.name === 'rest-v1');
      expect(restService).toBeDefined();
      expect(restService.url).toBe('http://rest:3000/');
    });
  });

  describe('generateSupabaseEnvTemplate', () => {
    it('should include all generated secrets', () => {
      const secrets = generateSupabaseSecrets();
      const envTemplate = generateSupabaseEnvTemplate(secrets);

      expect(envTemplate).toContain(`POSTGRES_PASSWORD=${secrets.postgresPassword}`);
      expect(envTemplate).toContain(`JWT_SECRET=${secrets.jwtSecret}`);
      expect(envTemplate).toContain(`ANON_KEY=${secrets.anonKey}`);
      expect(envTemplate).toContain(`SERVICE_KEY=${secrets.serviceKey}`);
    });

    it('should include SMTP configuration placeholders', () => {
      const secrets = generateSupabaseSecrets();
      const envTemplate = generateSupabaseEnvTemplate(secrets);

      expect(envTemplate).toContain('SMTP_HOST=');
      expect(envTemplate).toContain('SMTP_PORT=587');
      expect(envTemplate).toContain('SMTP_USER=');
      expect(envTemplate).toContain('SMTP_PASS=');
    });

    it('should include helpful comments', () => {
      const secrets = generateSupabaseSecrets();
      const envTemplate = generateSupabaseEnvTemplate(secrets);

      expect(envTemplate).toContain('# Supabase Production Secrets');
      expect(envTemplate).toContain('# Generated by Lightstack CLI');
      expect(envTemplate).toContain('SAVE THIS FILE SECURELY');
    });

    it('should include optional S3 configuration', () => {
      const secrets = generateSupabaseSecrets();
      const envTemplate = generateSupabaseEnvTemplate(secrets);

      expect(envTemplate).toContain('# Optional: S3 for file storage');
      expect(envTemplate).toContain('# AWS_ACCESS_KEY_ID=');
      expect(envTemplate).toContain('# S3_BUCKET_NAME=');
    });
  });
});
