# Data Model: Separate Development and Deployment Workflows

**Date**: 2025-10-09
**Feature**: Separate Development and Deployment Workflows

## Overview

This document defines the data structures and entities used to implement the separation between development and deployment workflows. Since this is primarily a refactoring feature with mode-based logic, the data model focuses on enumerations, configuration extensions, and command options.

## Core Entities

### 1. Mode (Enumeration)

Represents the two distinct operational modes of the CLI.

**Type**: `'development' | 'deployment'`

**Determination Logic**:
```typescript
function determineMode(env: string): Mode {
  return env === 'development' ? 'development' : 'deployment';
}
```

**Usage**:
- Input: environment name from `light up [env]` command
- Output: mode that controls which code path executes
- Default: `'development'` when no environment specified

**Validation Rules**:
- Mode is derived, not user-input directly
- Always resolves to one of two values

**State Transitions**: None (derived value, no state changes)

---

### 2. UpOptions (Interface)

Command options for the `light up` command.

**Fields**:
```typescript
interface UpOptions {
  env?: string;      // Environment name ('development', 'staging', 'production', etc.)
  detach?: boolean;  // Run containers in detached mode (default: true)
  ca?: string;       // Certificate authority provider ('letsencrypt' for DNS challenge, default: mkcert)
}
```

**Validation Rules**:
- `env`: Optional, defaults to `'development'`
- `detach`: Optional, defaults to `true`
- `ca`: Optional, only used in deployment mode; valid values: `'letsencrypt'` (default: mkcert when not specified)

**Usage**: Passed to `upCommand()` from Commander.js CLI parser

---

### 3. DockerfileConfig (Interface)

Configuration for Dockerfile generation.

**Fields**:
```typescript
interface DockerfileConfig {
  framework?: 'nextjs' | 'vite' | 'express' | 'generic';  // App framework
  nodeVersion?: string;                                     // Node.js version (default: '20')
  port?: number;                                            // Exposed port (default: 3000)
  buildCommand?: string;                                    // Build command (default: 'npm run build')
  startCommand?: string;                                    // Start command (default: 'npm start')
}
```

**Validation Rules**:
- All fields optional with sensible defaults
- `port` must be valid port number (1-65535)
- Commands must be non-empty strings if provided

**Usage**: Passed to `generateDockerfile()` utility function

**Default Values**:
```typescript
const DEFAULT_DOCKERFILE_CONFIG: DockerfileConfig = {
  framework: 'generic',
  nodeVersion: '20',
  port: 3000,
  buildCommand: 'npm run build',
  startCommand: 'npm start'
};
```

---

### 4. AppServiceConfig (Interface)

Configuration for the app service in Docker Compose.

**Fields**:
```typescript
interface AppServiceConfig {
  containerName: string;     // e.g., 'myproject-app'
  domain: string;             // e.g., 'app.local.lightstack.dev'
  port: number;               // Internal container port (default: 3000)
  environment: Record<string, string>;  // Environment variables
}
```

**Validation Rules**:
- `containerName` must match Docker naming conventions (lowercase, alphanumeric, hyphens)
- `domain` must be valid hostname
- `port` must match Dockerfile EXPOSE port

**Usage**: Used by compose file generator to create app service definition

**Example**:
```typescript
const appConfig: AppServiceConfig = {
  containerName: 'myproject-app',
  domain: 'app.local.lightstack.dev',
  port: 3000,
  environment: {
    NODE_ENV: 'production',
    PORT: '3000'
  }
};
```

---

### 5. DeploymentConfig (Extended - existing from Spec 001)

Existing deployment configuration from `light.config.yml`, **no changes needed** for this spec.

**Fields** (from Spec 001):
```typescript
interface DeploymentConfig {
  name: string;              // e.g., 'staging', 'production'
  domain?: string;            // Legacy field
  appDomain?: string;         // e.g., 'app.mysite.com'
  apiDomain?: string;         // e.g., 'api.mysite.com'
  studioDomain?: string;      // e.g., 'studio.mysite.com'
  host?: string;              // SSH host
  port?: number;              // SSH port
  user?: string;              // SSH user
  ssl?: {
    provider: string;         // 'letsencrypt' | 'custom'
    dns_provider?: string;    // 'cloudflare', 'route53', etc.
  };
}
```

**Note**: This entity already exists. Spec 002 uses it for deployment mode but doesn't modify its structure.

---

## Data Relationships

```
UpOptions (command input)
    |
    v
determineMode(env: string) --> Mode ('development' | 'deployment')
    |
    +-- Mode === 'development'
    |       |
    |       v
    |   deployDevMode()
    |       |
    |       +-- Generate Traefik proxy configs (file-based)
    |       +-- No Dockerfile needed
    |       +-- No app service in compose
    |
    +-- Mode === 'deployment'
            |
            v
        deployFullStackMode(env, options)
            |
            +-- Load DeploymentConfig from light.config.yml
            |
            +-- Generate Dockerfile (uses DockerfileConfig)
            |
            +-- Generate docker-compose.deployment.yml (uses AppServiceConfig)
            |
            +-- Start Supabase + App containers
```

---

## File-Based Data

### 1. Dockerfile (Generated)

**Location**: `Dockerfile` in user's project root

**Generated By**: `generateDockerfile(config: DockerfileConfig): string`

**Content**: Multi-stage Node.js Dockerfile (see research.md for pattern)

**Lifecycle**:
- Created during: `light init` (if doesn't exist)
- Used during: `light up <env>` for deployment mode
- Modified by: User (customization encouraged)

---

### 2. docker-compose.deployment.yml (Generated)

**Location**: `.light/docker-compose.deployment.yml` in user's project

**Generated By**: Compose file generator (updated in this spec)

**Content**: Full Supabase stack + app service definitions

**New Section** (added by this spec):
```yaml
services:
  app:
    build:
      context: ..
      dockerfile: Dockerfile
    container_name: ${PROJECT_NAME}-app
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - lightstack
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`app.${DOMAIN}`)"
      - "traefik.http.routers.app.tls=true"
      - "traefik.http.services.app.loadbalancer.server.port=3000"
```

**Lifecycle**:
- Created during: `light init`
- Renamed from: `docker-compose.production.yml` (breaking change, pre-release only)
- Used during: `light up <env>` for deployment mode

---

## Validation Summary

| Entity | Required Fields | Validation Rules | Default Values |
|--------|-----------------|------------------|----------------|
| Mode | N/A (derived) | Must be 'development' or 'deployment' | N/A |
| UpOptions | None (all optional) | env must be string, detach must be boolean, ca must be 'letsencrypt' if specified | env='development', detach=true, ca=undefined (uses mkcert) |
| DockerfileConfig | None (all optional) | port 1-65535, commands non-empty | nodeVersion='20', port=3000 |
| AppServiceConfig | All required | containerName valid Docker name, domain valid hostname | N/A |
| DeploymentConfig | name | Existing validation from Spec 001 | N/A |

---

## Migration Notes

**From Spec 001 to Spec 002**:

1. **No database migrations** - This is a CLI, not a data-driven application
2. **File renames**:
   - `.light/docker-compose.production.yml` → `.light/docker-compose.deployment.yml`
   - Users regenerate with `light init` (pre-release, no backward compat needed)
3. **Config changes**: None - `light.config.yml` schema unchanged
4. **New files**: `Dockerfile` in project root (generated if missing)

---

## Implementation Notes

- All entities are TypeScript interfaces (compile-time only, no runtime overhead)
- Mode determination is pure function (no side effects, easily testable)
- Configuration objects use optional fields with defaults (progressive disclosure)
- File generation is idempotent (running `light init` multiple times safe if files unchanged)
