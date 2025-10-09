import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';

// Zod schemas for validation
const ServiceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  port: z.number().int().positive(),
  healthCheck: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

const SSLConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['letsencrypt', 'manual']).optional(),
  dnsProvider: z.enum(['cloudflare', 'route53', 'digitalocean', 'gandi', 'namecheap']).optional(),
  // DNS API key is stored in .env, not config (secret should not be committed)
});

const DeploymentTargetSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(), // Legacy field (deprecated - use appDomain instead)
  appDomain: z.string().optional(), // Main app domain (e.g., app.mycompany.com or myapp.com)
  apiDomain: z.string().optional(), // API domain (defaults to api.{appDomain})
  studioDomain: z.string().optional(), // Studio domain (defaults to studio.{appDomain})
  host: z.string().optional(), // Override SSH target (e.g., internal IP via Tailscale)
  port: z.number().int().positive().optional(),
  user: z.string().optional(),
  ssl: SSLConfigSchema.optional(),
}).refine(
  (data) => data.appDomain || data.domain,
  { message: "Either 'appDomain' or 'domain' is required" }
);

const ProjectSchema = z.object({
  name: z.string().min(1),
  template: z.string().optional(),
  services: z.array(ServiceSchema),
  deployments: z.array(DeploymentTargetSchema).optional(),
  version: z.string().optional(),
});

export type ProjectConfig = z.infer<typeof ProjectSchema>;
export type ServiceConfig = z.infer<typeof ServiceSchema>;
export type DeploymentConfig = z.infer<typeof DeploymentTargetSchema>;

interface LoadConfigResult {
  config: ProjectConfig | null;
  filepath: string | null;
  error: string | null;
}

const MODULE_NAME = 'lightstack';
const CONFIG_FILES = [
  'light.config.yml',
  'light.config.yml',
  'light.config.json',
  '.lightstackrc.yaml',
  '.lightstackrc.yml',
  '.lightstackrc.json',
  '.lightstackrc',
];

/**
 * Load and validate project configuration
 */
export function loadProjectConfig(): LoadConfigResult {
  try {
    // Use cosmiconfig to find config file
    const explorer = cosmiconfigSync(MODULE_NAME, {
      searchPlaces: CONFIG_FILES,
      loaders: {
        '.yaml': yamlLoader,
        '.yml': yamlLoader,
      },
    });

    const result = explorer.search();

    if (!result) {
      // Try manual fallback for common locations
      const manualResult = tryManualConfigLoad();
      if (manualResult) {
        return validateConfig(manualResult.config, manualResult.filepath);
      }

      return {
        config: null,
        filepath: null,
        error: 'No configuration file found. Run "light init" to create one.',
      };
    }

    return validateConfig(result.config, result.filepath);

  } catch (error) {
    return {
      config: null,
      filepath: null,
      error: error instanceof Error ? error.message : 'Failed to load configuration',
    };
  }
}

/**
 * Manual fallback for loading config files
 */
function tryManualConfigLoad(): { config: unknown; filepath: string } | null {
  for (const filename of CONFIG_FILES) {
    const filepath = join(process.cwd(), filename);
    if (existsSync(filepath)) {
      try {
        const content = readFileSync(filepath, 'utf-8');

        if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
          return {
            config: yaml.load(content),
            filepath,
          };
        } else if (filename.endsWith('.json')) {
          return {
            config: JSON.parse(content),
            filepath,
          };
        }
      } catch {
        // Skip invalid files
      }
    }
  }
  return null;
}

/**
 * Custom YAML loader for cosmiconfig
 */
function yamlLoader(filepath: string, content: string): unknown {
  try {
    return yaml.load(content);
  } catch (error) {
    throw new Error(`Failed to parse YAML in ${filepath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate configuration against schema
 */
function validateConfig(config: unknown, filepath: string): LoadConfigResult {
  try {
    const validatedConfig = ProjectSchema.parse(config);
    return {
      config: validatedConfig,
      filepath,
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
      return {
        config: null,
        filepath,
        error: `Configuration validation failed in ${filepath}:\n${issues}`,
      };
    }
    return {
      config: null,
      filepath,
      error: `Invalid configuration in ${filepath}`,
    };
  }
}

/**
 * Get configuration or throw error
 */
export function getProjectConfig(): ProjectConfig {
  const result = loadProjectConfig();

  if (!result.config) {
    console.error(chalk.red('✗'), result.error);
    process.exit(1);
  }

  return result.config;
}

/**
 * Load environment-specific configuration
 */
export function loadEnvironmentConfig(environment: string): Record<string, string> {
  const envFile = `.env.${environment}`;
  const defaultEnvFile = '.env';
  const config: Record<string, string> = {};

  // Load default .env file first
  if (existsSync(defaultEnvFile)) {
    const content = readFileSync(defaultEnvFile, 'utf-8');
    parseEnvFile(content, config);
  }

  // Override with environment-specific values
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, 'utf-8');
    parseEnvFile(content, config);
  }

  return config;
}

/**
 * Parse .env file content
 */
function parseEnvFile(content: string, config: Record<string, string>): void {
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    if (!line || line.trim().startsWith('#')) {
      continue;
    }

    const [key, ...valueParts] = line.split('=');
    if (key?.trim()) {
      const value = valueParts.join('=').trim();
      // Remove quotes if present
      config[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
  }
}

/**
 * Merge configuration with defaults
 */
export function mergeWithDefaults(config: Partial<ProjectConfig>): ProjectConfig {
  const defaults: Partial<ProjectConfig> = {
    version: '1.0.0',
    services: [],
    deployments: [],
  };

  return {
    ...defaults,
    ...config,
    name: config.name || 'lightstack-app',
    services: config.services || [],
  } as ProjectConfig;
}