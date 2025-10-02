import { existsSync, readFileSync } from 'fs';

export interface SupabasePorts {
  api: number;
  studio: number;
}

const DEFAULT_PORTS: SupabasePorts = {
  api: 54321,
  studio: 54323,
};

/**
 * Parse Supabase config.toml to extract port configuration
 * Falls back to default ports if config is not found or cannot be parsed
 */
export function getSupabasePorts(): SupabasePorts {
  const configPath = 'supabase/config.toml';

  if (!existsSync(configPath)) {
    return DEFAULT_PORTS;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const ports: SupabasePorts = { ...DEFAULT_PORTS };

    // Parse API port from [api] section
    const apiMatch = content.match(/\[api\][^[]*port\s*=\s*(\d+)/s);
    if (apiMatch?.[1]) {
      ports.api = parseInt(apiMatch[1], 10);
    }

    // Parse Studio port from [studio] section
    const studioMatch = content.match(/\[studio\][^[]*port\s*=\s*(\d+)/s);
    if (studioMatch?.[1]) {
      ports.studio = parseInt(studioMatch[1], 10);
    }

    return ports;
  } catch (error) {
    // If we can't parse the config, fall back to defaults
    console.warn('Warning: Could not parse supabase/config.toml, using default ports');
    return DEFAULT_PORTS;
  }
}
