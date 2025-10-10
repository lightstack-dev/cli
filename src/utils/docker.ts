import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

export type Mode = 'development' | 'deployment';

export type SSLProvider = 'mkcert' | 'letsencrypt';

/**
 * Determines whether to run in development or deployment mode based on environment name
 */
export function determineMode(env: string): Mode {
  return env === 'development' ? 'development' : 'deployment';
}

/**
 * Returns the list of Docker Compose files to use based on the mode
 */
export function getComposeFiles(env: string): string[] {
  const baseFile = '.light/docker-compose.yml';
  const mode = determineMode(env);

  if (mode === 'development') {
    return [baseFile, '.light/docker-compose.development.yml'];
  } else {
    return [
      baseFile,
      '.light/docker-compose.deployment.yml',
      '.light/docker-compose.supabase.yml'
    ];
  }
}

/**
 * Builds a Docker Compose command with the specified files and options
 */
export function buildDockerCommand(
  composeFiles: string[],
  command: string,
  options: { detach?: boolean; service?: string } = {}
): string {
  const fileArgs = composeFiles.map(f => `-f ${f}`).join(' ');
  let cmd = `docker compose ${fileArgs} ${command}`;

  if (options.detach && command === 'up') {
    cmd += ' -d';
  }

  if (options.service) {
    cmd += ` ${options.service}`;
  }

  return cmd;
}

/**
 * Validates the SSL provider option
 */
export function validateSSLProvider(provider: string | undefined): SSLProvider {
  if (!provider) return 'mkcert';

  if (provider !== 'mkcert' && provider !== 'letsencrypt') {
    throw new Error(`Invalid SSL provider: ${provider}. Must be 'mkcert' or 'letsencrypt'`);
  }

  return provider as SSLProvider;
}

/**
 * Detects currently running Lightstack environment by checking the .current-env file
 */
export function detectRunningEnvironment(): string | null {
  const currentEnvFile = '.light/.current-env';

  if (!existsSync(currentEnvFile)) {
    return null;
  }

  try {
    const currentEnv = readFileSync(currentEnvFile, 'utf-8').trim();

    // Verify Traefik is actually running
    const result = execSync('docker ps --format "{{.Names}}" 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    if (result.includes('lightstack-traefik')) {
      return currentEnv;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if Supabase CLI development environment is running
 */
export function checkSupabaseDevEnvironment(): boolean {
  try {
    // Check common Supabase CLI ports
    const ports = [
      54321, // Kong API Gateway
      54323, // Auth
      54324, // Studio
    ];

    for (const port of ports) {
      try {
        // Platform-specific port check
        if (process.platform === 'win32') {
          const result = execSync(`netstat -an | findstr :${port}.*LISTENING`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
          });
          if (result) return true;
        } else {
          const result = execSync(`lsof -i :${port} 2>/dev/null | grep LISTEN`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
          });
          if (result) return true;
        }
      } catch {
        // Port not in use, continue checking
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if ports 80 and 443 are occupied by non-Lightstack processes
 */
export function checkPortConflicts(): { process: string; ports: number[] } | null {
  try {
    const conflicts: { process: string; ports: number[] } = { process: '', ports: [] };

    for (const port of [80, 443]) {
      try {
        let result: string;

        if (process.platform === 'win32') {
          result = execSync(`netstat -ano | findstr :${port}.*LISTENING`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
          });

          if (result) {
            // Extract PID from Windows netstat output
            const pid = result.trim().split(/\s+/).pop();
            if (pid) {
              // Get process name from PID
              const processInfo = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'ignore']
              });
              const lines = processInfo.trim().split('\n');
              if (lines.length > 1) {
                const processName = lines[1]?.split(',')[0]?.replace(/"/g, '') || '';
                if (processName && !processName.includes('com.docker') && !processName.includes('Docker')) {
                  conflicts.process = processName;
                  conflicts.ports.push(port);
                }
              }
            }
          }
        } else {
          result = execSync(`lsof -i :${port} 2>/dev/null | grep LISTEN`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
          });

          if (result) {
            const parts = result.trim().split(/\s+/);
            const processName = parts[0] || '';

            if (processName && !processName.includes('docker') && !processName.includes('Docker')) {
              conflicts.process = processName;
              conflicts.ports.push(port);
            }
          }
        }
      } catch {
        // Port not in use, continue
      }
    }

    if (conflicts.ports.length > 0) {
      return conflicts;
    }

    return null;
  } catch {
    return null;
  }
}