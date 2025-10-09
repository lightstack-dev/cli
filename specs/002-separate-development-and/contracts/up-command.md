# Contract: up Command Refactoring

**Feature**: Separate Development and Deployment Workflows
**Date**: 2025-10-09

## Overview

This contract defines the function signatures and responsibilities for the refactored `up` command. The refactoring splits the monolithic `upCommand()` into two dedicated mode-specific functions with clear separation of concerns.

---

## Public API (CLI Interface)

### `upCommand(options?: UpOptions): Promise<void>`

**Purpose**: Main entry point for `light up [env]` command

**Signature**:
```typescript
export async function upCommand(options?: UpOptions): Promise<void>
```

**Parameters**:
- `options`: Optional configuration object
  - `env?: string` - Environment name (default: 'development')
  - `detach?: boolean` - Run containers in detached mode (default: true)
  - `ca?: string` - Certificate authority provider ('letsencrypt' for DNS challenge in deployment mode, default: mkcert)

**Behavior**:
1. Determine mode from environment name
2. Run common prerequisite checks (Docker running, config exists, etc.)
3. Branch to `deployDevMode()` or `deployFullStackMode()` based on mode
4. Handle top-level errors with user-friendly messages

**Error Handling**:
- Throws descriptive errors for prerequisite failures
- Catches and formats errors from mode-specific functions
- Exits with code 1 on failure

**Example Usage**:
```typescript
// From CLI: light up
await upCommand();

// From CLI: light up staging
await upCommand({ env: 'staging' });

// From CLI: light up production --no-detach
await upCommand({ env: 'production', detach: false });

// From CLI: light up staging --ca letsencrypt
await upCommand({ env: 'staging', ca: 'letsencrypt' });
```

---

## Mode-Specific Functions

### `deployDevMode(options: UpOptions): Promise<void>`

**Purpose**: Start development mode (proxy only)

**Signature**:
```typescript
async function deployDevMode(options: UpOptions): Promise<void>
```

**Parameters**:
- `options`: Command options (already validated by `upCommand`)

**Responsibilities**:
1. Setup SSL certificates (mkcert)
2. Generate Traefik proxy configuration (file-based dynamic.yml)
3. Start Traefik container only
4. Show development-specific routing and guidance

**Pre-conditions**:
- Docker is running
- Project is initialized (`light.config.yml` exists)
- Mode has been determined as 'development'

**Post-conditions**:
- Traefik container running
- mkcert certificates generated in `.light/certs/`
- `.light/traefik/dynamic.yml` created with proxy rules
- User sees: "Start your app: npm run dev" message

**Side Effects**:
- Creates/updates `.light/traefik/tls.yml`
- Creates/updates `.light/traefik/dynamic.yml`
- Starts Docker container (`<project>-router`)

**Error Cases**:
- mkcert not installed → Warning, proceed without SSL
- Traefik container fails → Show recovery options
- Container already running → Validate and reuse or restart

**Example Flow**:
```typescript
async function deployDevMode(options: UpOptions) {
  // 1. Setup SSL
  const mkcertResult = setupMkcert();
  if (mkcertResult.certsGenerated) {
    writeFileSync('.light/traefik/tls.yml', generateTlsConfig(...));
  }

  // 2. Generate proxy configs
  const dynamicConfig = generateTraefikDynamicConfig(
    projectConfig.services,
    detectBaaSServices()
  );
  writeFileSync('.light/traefik/dynamic.yml', dynamicConfig);

  // 3. Start Traefik
  const composeFiles = getComposeFiles('development');
  const dockerCmd = buildDockerCommand(composeFiles, { detach: options.detach });
  execSync(dockerCmd);

  // 4. Show guidance
  showRouterStatus(projectConfig, 'development');
}
```

---

### `deployFullStackMode(env: string, options: UpOptions): Promise<void>`

**Purpose**: Start deployment mode (full containerized stack)

**Signature**:
```typescript
async function deployFullStackMode(env: string, options: UpOptions): Promise<void>
```

**Parameters**:
- `env`: Deployment environment name ('staging', 'production', 'qa', etc.)
- `options`: Command options (already validated by `upCommand`)

**Responsibilities**:
1. Check for running Lightstack environments (port 80, 443 conflicts)
2. Check for Supabase CLI conflicts (port 5432, etc.)
3. Validate Dockerfile exists
4. Generate/update Supabase secrets in `.env`
5. Generate Supabase stack configuration with SSL provider based on `options.ca`
6. Build app Docker image
7. Start full stack (Traefik + Supabase services + app container)
8. Run database migrations
9. Show deployment-specific routing (NO "start your app" message)
10. Show SSL provider info message if using mkcert (default)

**Pre-conditions**:
- Docker is running
- Project is initialized
- Mode has been determined as 'deployment'
- Environment is configured in `light.config.yml` deployments
- `Dockerfile` exists in project root

**Post-conditions**:
- All Supabase containers running (db, kong, auth, rest, storage, studio, etc.)
- App container running (built from Dockerfile)
- Traefik routing to containerized services
- Database migrations applied
- User sees: containerized service URLs (NO npm run dev message)

**Side Effects**:
- Creates/updates `.env` with Supabase secrets
- Creates/updates `.light/.env` with Supabase-format env vars
- Builds Docker image for app
- Starts ~10 Docker containers
- Runs database migrations

**Error Cases**:
- Supabase CLI running → Prompt user to stop
- Dockerfile missing/invalid → Show error with fix instructions
- App build fails → Show build logs and troubleshooting
- Container startup fails → Show recovery options
- Migrations fail → Show migration errors and manual command

**Example Flow**:
```typescript
async function deployFullStackMode(env: string, options: UpOptions) {
  // 1. Check for running environments
  const runningEnv = await detectRunningEnvironment();
  if (runningEnv) {
    if (runningEnv === env) {
      console.log(`Environment '${env}' is already running.`);
      showRouterStatus(projectConfig, env);
      return;
    }
    const shouldSwitch = await confirm(`Stop '${runningEnv}' and start '${env}'?`, true);
    if (shouldSwitch) {
      execSync('light down');
    } else {
      process.exit(0);
    }
  }

  // 2. Check Supabase CLI conflicts
  if (checkSupabaseDevEnvironment()) {
    const shouldStop = await confirm('Stop Supabase CLI?');
    if (shouldStop) execSync('supabase stop');
    else process.exit(0);
  }

  // 3. Validate Dockerfile
  if (!existsSync('Dockerfile')) {
    throw new Error('Dockerfile not found. Run `light init` to generate.');
  }

  // 4. Generate secrets
  const { secrets, generated } = loadOrGenerateSecrets(env);
  if (generated) console.log('✓ Secrets generated in .env');

  // 5. Determine SSL provider
  const sslProvider = options.ca === 'letsencrypt' ? 'letsencrypt' : 'mkcert';

  // 6. Generate Supabase stack configs with SSL provider
  await generateProductionStack(projectConfig, env, { sslProvider });

  // 7. Build & start
  const composeFiles = getComposeFiles(env); // includes deployment.yml
  const dockerCmd = buildDockerCommand(composeFiles, {
    detach: options.detach,
    domain: getAppDomain(deployment)
  });
  execSync(dockerCmd); // Builds app image automatically via compose

  // 8. Run migrations
  runSupabaseMigrations(projectConfig.name, env, supabaseCli);

  // 9. Show deployment guidance (no "start your app")
  showRouterStatus(projectConfig, env);

  // 10. Show SSL info if using mkcert (default)
  if (sslProvider === 'mkcert') {
    console.log('ℹ Using mkcert certificates (fast local testing). To use Let\'s Encrypt: light up <env> --ca letsencrypt');
  }
}
```

---

## Utility Functions

### `determineMode(env: string): Mode`

**Purpose**: Determine mode from environment name

**Signature**:
```typescript
function determineMode(env: string): 'development' | 'deployment'
```

**Logic**:
```typescript
return env === 'development' ? 'development' : 'deployment';
```

**Test Cases**:
```typescript
expect(determineMode('development')).toBe('development');
expect(determineMode('staging')).toBe('deployment');
expect(determineMode('production')).toBe('deployment');
expect(determineMode('qa')).toBe('deployment');
```

---

### `commonPrerequisiteChecks(env: string): Promise<void>`

**Purpose**: Validate prerequisites before mode-specific execution

**Signature**:
```typescript
async function commonPrerequisiteChecks(env: string): Promise<void>
```

**Checks**:
1. Docker is running (`docker info`)
2. Project is initialized (`light.config.yml` exists)
3. Environment exists in config (for non-development)
4. Prompt to configure if missing

**Throws**:
- "Docker is not running"
- "No Lightstack project found. Run 'light init' first"
- (Prompts interactively for missing environment, doesn't throw)

---

### `getComposeFiles(env: string): string[]`

**Purpose**: Get Docker Compose file list for environment

**Signature**:
```typescript
function getComposeFiles(env: string): string[]
```

**Logic**:
```typescript
const files = ['.light/docker-compose.yml'];

if (env === 'development') {
  files.push('.light/docker-compose.development.yml');
} else {
  files.push('.light/docker-compose.deployment.yml');
  if (existsSync('.light/docker-compose.supabase-overrides.yml')) {
    files.push('.light/docker-compose.supabase-overrides.yml');
  }
}

return files;
```

---

### `showRouterStatus(config: ProjectConfig, env: string): void`

**Purpose**: Display routing URLs and next steps based on mode

**Signature**:
```typescript
function showRouterStatus(config: ProjectConfig, env: string): void
```

**Behavior**:
- Development mode: Show app URLs + "Start your app: npm run dev"
- Deployment mode: Show app URLs + NO "start your app" message
- Always show: Traefik dashboard (dev only), management commands

**Output Example (Development)**:
```
Routing ready:
  ✓ https://app.lvh.me → Your application
  ✓ https://api.lvh.me → Supabase API
  ✓ https://studio.lvh.me → Supabase Studio
  ✓ https://router.lvh.me → Router dashboard

Next steps:
  Start your app: npm run dev

Manage Lightstack infrastructure:
  Restart: light restart
  Stop:    light down
```

**Output Example (Deployment)**:
```
Routing ready:
  ✓ https://app.local.lightstack.dev → Your application (containerized)
  ✓ https://api.local.lightstack.dev → Supabase API
  ✓ https://studio.local.lightstack.dev → Supabase Studio

Manage Lightstack infrastructure:
  Restart: light restart
  Stop:    light down

Manage deployments:
  Add deployment target: light env add <name>
```

---

## Testing Contracts

### Unit Tests

```typescript
describe('determineMode', () => {
  it('returns development for "development"', () => {
    expect(determineMode('development')).toBe('development');
  });

  it('returns deployment for any other env', () => {
    expect(determineMode('staging')).toBe('deployment');
    expect(determineMode('production')).toBe('deployment');
  });
});

describe('getComposeFiles', () => {
  it('returns dev files for development env', () => {
    const files = getComposeFiles('development');
    expect(files).toContain('.light/docker-compose.development.yml');
    expect(files).not.toContain('.light/docker-compose.deployment.yml');
  });

  it('returns deployment files for non-dev env', () => {
    const files = getComposeFiles('staging');
    expect(files).toContain('.light/docker-compose.deployment.yml');
    expect(files).not.toContain('.light/docker-compose.development.yml');
  });
});
```

### Integration Tests (Mocked)

```typescript
describe('upCommand', () => {
  it('calls deployDevMode for development', async () => {
    const spy = vi.spyOn(upModule, 'deployDevMode');
    await upCommand({ env: 'development' });
    expect(spy).toHaveBeenCalled();
  });

  it('calls deployFullStackMode for staging', async () => {
    const spy = vi.spyOn(upModule, 'deployFullStackMode');
    await upCommand({ env: 'staging' });
    expect(spy).toHaveBeenCalledWith('staging', expect.any(Object));
  });
});
```

---

## Migration Path

**From Current Implementation**:

1. Extract `determineMode()` from conditional logic
2. Extract common setup into `commonPrerequisiteChecks()`
3. Move lines 94-168 (dev mode) into `deployDevMode()`
4. Move lines 99-260 (deployment setup + start) into `deployFullStackMode()`
5. Refactor `showRouterStatus()` to be mode-aware
6. Update tests to cover new function boundaries

**Backward Compatibility**: None needed (pre-release)

---

## Success Criteria

- ✅ `light up` starts only Traefik (development mode)
- ✅ `light up staging` starts full stack including app container
- ✅ Mode detection is explicit and testable
- ✅ Code paths are independent (no mingling)
- ✅ User guidance is mode-appropriate
- ✅ All existing Spec 001 functionality preserved
