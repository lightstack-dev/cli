import { existsSync, mkdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

export interface MkcertResult {
  installed: boolean;
  caInstalled: boolean;
  certsGenerated: boolean;
  certPath?: string;
  keyPath?: string;
}

/**
 * Check if mkcert is installed on the system
 */
export function isMkcertInstalled(): boolean {
  try {
    execSync('mkcert -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if mkcert CA is installed
 */
export function isCaInstalled(): boolean {
  try {
    const result = execSync('mkcert -check', { encoding: 'utf-8', stdio: 'pipe' });
    return !result.includes('is not installed');
  } catch {
    return false;
  }
}

/**
 * Install mkcert CA certificate
 */
export function installCa(): boolean {
  try {
    console.log(chalk.blue('🔐'), 'Installing local CA certificate...');
    console.log(chalk.gray('    This may require administrator privileges'));

    const result = spawnSync('mkcert', ['-install'], {
      stdio: 'inherit',
      shell: true
    });

    if (result.status === 0) {
      console.log(chalk.green('✅'), 'Local CA certificate installed');
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Generate SSL certificates for local development
 */
export function generateCertificates(domains: string[] = ['*.lvh.me', 'lvh.me']): MkcertResult {
  const result: MkcertResult = {
    installed: false,
    caInstalled: false,
    certsGenerated: false
  };

  // Check if mkcert is installed
  if (!isMkcertInstalled()) {
    console.log(chalk.yellow('⚠️'), 'mkcert is not installed');
    console.log('\nTo install mkcert:');
    console.log('  macOS:    brew install mkcert');
    console.log('  Windows:  choco install mkcert');
    console.log('  Linux:    https://github.com/FiloSottile/mkcert#installation');
    console.log('\nAfter installing, run "light up" again.');
    return result;
  }

  result.installed = true;

  // Check if CA is installed
  if (!isCaInstalled()) {
    console.log(chalk.yellow('⚠️'), 'Local CA certificate not installed');
    const installed = installCa();
    if (!installed) {
      console.log(chalk.red('❌'), 'Failed to install CA certificate');
      console.log('Try running: mkcert -install');
      return result;
    }
  }

  result.caInstalled = true;

  // Create certs directory
  const certsDir = '.light/certs';
  mkdirSync(certsDir, { recursive: true });

  // Define certificate paths
  const certName = 'local';
  const certPath = join(certsDir, `${certName}.pem`);
  const keyPath = join(certsDir, `${certName}-key.pem`);

  // Check if certificates already exist
  if (existsSync(certPath) && existsSync(keyPath)) {
    // Silent - certificates already exist
    result.certsGenerated = true;
    result.certPath = certPath;
    result.keyPath = keyPath;
    return result;
  }

  // Generate certificates
  const spinner = ora('Generating SSL certificates...').start();

  try {
    const domainsArg = domains.join(' ');
    const cmd = `mkcert -cert-file ${certPath} -key-file ${keyPath} ${domainsArg}`;

    execSync(cmd, {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    spinner.succeed('SSL certificates generated');

    result.certsGenerated = true;
    result.certPath = certPath;
    result.keyPath = keyPath;

  } catch (error) {
    spinner.fail('Failed to generate certificates');
    console.log(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    console.log('\nTry running manually:');
    console.log(`  cd ${certsDir}`);
    console.log(`  mkcert ${domains.join(' ')}`);
  }

  return result;
}

/**
 * Setup mkcert for the project
 */
export function setupMkcert(): MkcertResult {
  const result = generateCertificates();

  if (!result.installed) {
    console.log(chalk.yellow('⚠️'), 'SSL certificates not configured');
    console.log('HTTPS will not be available until mkcert is installed');
  }

  return result;
}

/**
 * Update Traefik configuration to use mkcert certificates
 */
export function generateTraefikTlsConfig(certPath: string, keyPath: string): string {
  // Extract just the filename, handling both Windows and Unix paths
  const certFile = certPath.split(/[/\\]/).pop();
  const keyFile = keyPath.split(/[/\\]/).pop();

  return `tls:
  certificates:
    - certFile: /certs/${certFile}
      keyFile: /certs/${keyFile}
      stores:
        - default
  stores:
    default:
      defaultCertificate:
        certFile: /certs/${certFile}
        keyFile: /certs/${keyFile}
`;
}