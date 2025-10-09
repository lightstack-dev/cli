import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'zod';

const UserConfigSchema = z.object({
  acmeEmail: z.string().email().optional(),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

const USER_CONFIG_DIR = join(homedir(), '.lightstack');
const USER_CONFIG_PATH = join(USER_CONFIG_DIR, 'config.yml');

/**
 * Load user configuration from ~/.lightstack/config.yml
 */
export function loadUserConfig(): UserConfig {
  if (!existsSync(USER_CONFIG_PATH)) {
    return {};
  }

  try {
    const content = readFileSync(USER_CONFIG_PATH, 'utf-8');
    const parsed = yaml.load(content);
    return UserConfigSchema.parse(parsed);
  } catch (error) {
    console.warn(`Warning: Failed to parse user config at ${USER_CONFIG_PATH}`);
    return {};
  }
}

/**
 * Save user configuration to ~/.lightstack/config.yml
 */
export function saveUserConfig(config: UserConfig): void {
  // Ensure directory exists
  if (!existsSync(USER_CONFIG_DIR)) {
    mkdirSync(USER_CONFIG_DIR, { recursive: true });
  }

  // Write config file
  const content = yaml.dump(config, { indent: 2, lineWidth: 80, noRefs: true });
  writeFileSync(USER_CONFIG_PATH, content, 'utf-8');
}

/**
 * Get ACME email from user config
 */
export function getAcmeEmail(): string | undefined {
  const config = loadUserConfig();
  return config.acmeEmail;
}

/**
 * Set ACME email in user config
 */
export function setAcmeEmail(email: string): void {
  const config = loadUserConfig();
  config.acmeEmail = email;
  saveUserConfig(config);
}

/**
 * Check if ACME email is configured
 */
export function hasAcmeEmail(): boolean {
  return getAcmeEmail() !== undefined;
}

/**
 * Get user config path for display
 */
export function getUserConfigPath(): string {
  return USER_CONFIG_PATH;
}
