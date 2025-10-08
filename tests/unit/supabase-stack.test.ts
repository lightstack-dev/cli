import { describe, it, expect } from 'vitest';
import { generateSupabaseSecrets, generateSupabaseEnvFile } from '../../src/utils/supabase-stack.js';

describe('Supabase Stack Utilities', () => {
  describe('generateSupabaseSecrets', () => {
    it('should generate all required secrets', () => {
      const secrets = generateSupabaseSecrets();

      expect(secrets).toHaveProperty('postgresPassword');
      expect(secrets).toHaveProperty('jwtSecret');
      expect(secrets).toHaveProperty('anonKey');
      expect(secrets).toHaveProperty('serviceKey');
      expect(secrets).toHaveProperty('vaultEncKey');
      expect(secrets).toHaveProperty('pgMetaCryptoKey');
    });

    it('should generate unique secrets each time', () => {
      const secrets1 = generateSupabaseSecrets();
      const secrets2 = generateSupabaseSecrets();

      expect(secrets1.postgresPassword).not.toBe(secrets2.postgresPassword);
      expect(secrets1.jwtSecret).not.toBe(secrets2.jwtSecret);
      expect(secrets1.anonKey).not.toBe(secrets2.anonKey);
      expect(secrets1.serviceKey).not.toBe(secrets2.serviceKey);
      expect(secrets1.vaultEncKey).not.toBe(secrets2.vaultEncKey);
      expect(secrets1.pgMetaCryptoKey).not.toBe(secrets2.pgMetaCryptoKey);
    });

    it('should generate non-empty secrets', () => {
      const secrets = generateSupabaseSecrets();

      expect(secrets.postgresPassword.length).toBeGreaterThan(20);
      expect(secrets.jwtSecret.length).toBeGreaterThan(20);
      expect(secrets.anonKey.length).toBeGreaterThan(20);
      expect(secrets.serviceKey.length).toBeGreaterThan(20);
      expect(secrets.vaultEncKey.length).toBeGreaterThan(0);
      expect(secrets.pgMetaCryptoKey.length).toBeGreaterThan(0);
    });

    it('should generate vault encryption key with exactly 32 characters', () => {
      const secrets = generateSupabaseSecrets();

      // Vault encryption key must be exactly 32 characters for AES-256
      expect(secrets.vaultEncKey.length).toBe(32);
    });
  });

  describe('generateSupabaseEnvFile', () => {
    const mockSecrets = {
      PRODUCTION_POSTGRES_PASSWORD: 'test-postgres-pass',
      PRODUCTION_JWT_SECRET: 'test-jwt-secret',
      PRODUCTION_ANON_KEY: 'test-anon-key',
      PRODUCTION_SERVICE_KEY: 'test-service-key',
      PRODUCTION_VAULT_ENC_KEY: 'test-vault-key-32-chars-exact!',
      PRODUCTION_PG_META_CRYPTO_KEY: 'test-pg-meta-key-64-chars',
    };

    it('should generate valid env file content', () => {
      const envContent = generateSupabaseEnvFile('production', 'test-project', 'app.example.com', 'api.example.com', 'studio.example.com', mockSecrets);

      expect(envContent).toContain('POSTGRES_PASSWORD=test-postgres-pass');
      expect(envContent).toContain('JWT_SECRET=test-jwt-secret');
      expect(envContent).toContain('ANON_KEY=test-anon-key');
      expect(envContent).toContain('SERVICE_ROLE_KEY=test-service-key');
    });

    it('should include project name in configuration', () => {
      const envContent = generateSupabaseEnvFile('production', 'my-app', 'app.example.com', 'api.example.com', 'studio.example.com', mockSecrets);

      expect(envContent).toContain('STUDIO_DEFAULT_ORGANIZATION=my-app');
      expect(envContent).toContain('STUDIO_DEFAULT_PROJECT=my-app');
      expect(envContent).toContain('SMTP_SENDER_NAME=my-app');
    });

    it('should include domain in API URLs', () => {
      const envContent = generateSupabaseEnvFile('production', 'test-project', 'app.example.com', 'api.example.com', 'studio.example.com', mockSecrets);

      expect(envContent).toContain('API_EXTERNAL_URL=https://api.example.com');
      expect(envContent).toContain('SUPABASE_PUBLIC_URL=https://api.example.com');
      expect(envContent).toContain('SITE_URL=https://app.example.com');
    });

    it('should disable email autoconfirm in production', () => {
      const envContent = generateSupabaseEnvFile('production', 'test-project', 'app.example.com', 'api.example.com', 'studio.example.com', mockSecrets);

      expect(envContent).toContain('ENABLE_EMAIL_AUTOCONFIRM=false');
    });

    it('should enable email autoconfirm in development', () => {
      const envContent = generateSupabaseEnvFile('development', 'test-project', 'localhost', 'api.localhost', 'studio.localhost', mockSecrets);

      expect(envContent).toContain('ENABLE_EMAIL_AUTOCONFIRM=true');
    });

    it('should include SMTP configuration placeholders', () => {
      const envContent = generateSupabaseEnvFile('production', 'test-project', 'app.example.com', 'api.example.com', 'studio.example.com', mockSecrets);

      expect(envContent).toContain('SMTP_HOST=');
      expect(envContent).toContain('SMTP_PORT=587');
      expect(envContent).toContain('SMTP_USER=');
      expect(envContent).toContain('SMTP_PASS=');
    });

    it('should include database configuration', () => {
      const envContent = generateSupabaseEnvFile('production', 'test-project', 'app.example.com', 'api.example.com', 'studio.example.com', mockSecrets);

      expect(envContent).toContain('POSTGRES_HOST=db');
      expect(envContent).toContain('POSTGRES_PORT=5432');
      expect(envContent).toContain('POSTGRES_DB=postgres');
    });

    it('should include encryption keys', () => {
      const envContent = generateSupabaseEnvFile('production', 'test-project', 'app.example.com', 'api.example.com', 'studio.example.com', mockSecrets);

      expect(envContent).toContain('VAULT_ENC_KEY=test-vault-key-32-chars-exact!');
      expect(envContent).toContain('PG_META_CRYPTO_KEY=test-pg-meta-key-64-chars');
    });

    it('should extract secrets from environment-prefixed keys', () => {
      const devSecrets = {
        DEVELOPMENT_POSTGRES_PASSWORD: 'dev-pass',
        DEVELOPMENT_JWT_SECRET: 'dev-jwt',
        DEVELOPMENT_ANON_KEY: 'dev-anon',
        DEVELOPMENT_SERVICE_KEY: 'dev-service',
        DEVELOPMENT_VAULT_ENC_KEY: 'dev-vault-32-chars-exactly!!!',
        DEVELOPMENT_PG_META_CRYPTO_KEY: 'dev-pg-meta-key',
      };

      const envContent = generateSupabaseEnvFile('development', 'test-project', 'localhost', 'api.localhost', 'studio.localhost', devSecrets);

      expect(envContent).toContain('POSTGRES_PASSWORD=dev-pass');
      expect(envContent).toContain('JWT_SECRET=dev-jwt');
    });
  });
});
