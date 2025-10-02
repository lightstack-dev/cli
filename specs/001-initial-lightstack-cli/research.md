# Research Findings: Lightstack CLI Technical Decisions

**Date**: 2025-09-18 (Revised)
**Feature**: Lightstack CLI Core Foundation

## Executive Summary
Research conducted to resolve technical unknowns for building a TypeScript-based CLI tool that orchestrates BaaS development workflows with Docker deployment capabilities. Revised to align with constitution principle: "Don't Reinvent the Wheel".

## 1. TypeScript CLI Framework

**Decision**: Commander.js with TypeScript
**Rationale**:
- Most mature and battle-tested CLI framework for Node.js
- Excellent TypeScript support
- Used by major CLIs (Vue CLI, Angular CLI, Create React App)
- Automatic help generation, subcommands, options parsing

**Alternatives Considered**:
- Yargs: More complex API, overkill for our needs
- Oclif: Too opinionated, adds unnecessary complexity
- Cliffy: Deno-based, not Node.js compatible
- Native Node.js: Too low-level, reinventing the wheel

## 2. Docker Compose Orchestration

**Decision**: Generate docker-compose files + shell out to docker-compose CLI
**Rationale**:
- Users can understand and modify generated files (Configuration Over Code)
- Leverages Docker Compose's mature orchestration capabilities
- Standard override pattern: base + environment-specific files
- No need to reimplement complex orchestration logic

**File Structure**:
```yaml
docker-compose.yml          # Base configuration
docker-compose.dev.yml      # Development overrides (mkcert certs, hot reload)
docker-compose.prod.yml     # Production overrides (Let's Encrypt, replicas)
```

**Command Mapping**:
- `light up` → `docker compose -f .light/docker-compose.yml -f .light/docker-compose.dev.yml --env-file ./.env up -d`
- `light down` → `docker compose -f .light/docker-compose.yml -f .light/docker-compose.dev.yml --env-file ./.env down`
- `light deploy` → Generates and deploys production compose files to remote targets
- Direct orchestration via shell commands, not Docker SDK

## 3. Configuration Management

**Decision**: Cosmiconfig for config discovery + JSON Schema validation
**Rationale**:
- Industry standard for finding and loading config (used by Prettier, ESLint, etc.)
- Supports multiple formats (.lightstackrc, lightstack.config.js, package.json)
- Built-in caching and schema validation support

**File Structure**:
```
~/.lightstack/
└── config.yml                          # User config (ACME email - PII)

project-root/
├── light.config.yml                    # Project config (NO secrets)
├── .env                                # Secrets (gitignored)
├── Dockerfile                          # Production build instructions
└── .light/
    ├── docker-compose.yml              # Base configuration
    ├── docker-compose.development.yml  # Dev overrides
    ├── docker-compose.production.yml   # Prod overrides (full stack)
    ├── certs/                          # Local SSL certificates (mkcert)
    └── deployments/                    # Deployment history and state
```

**Environment Variable Strategy**:
- **User config for PII**: `~/.lightstack/config.yml` stores ACME_EMAIL (not in project)
- **CLI writes secrets to .env**: DNS_API_KEY and other secrets written when configuring environments
- **No secret copying**: Local and remote `.env` files are separate (CLI prompts for secrets when needed)
- **Explicit .env loading**: Docker Compose commands use `--env-file ./.env`
- **Environment-specific configs**: Different environments via Docker Compose override files
- **Production secrets**: Generated on remote server during first deploy (never copied from local)

**Environment Validation**:
- Warns when `.env` file is missing but provides defaults
- Checks for required variables in production deployments (e.g., ACME_EMAIL)
- Shows informational notes about common missing variables
- Graceful degradation with helpful error messages

## 4. Deployment Configuration Management

**Decision**: YAML configuration with multiple environment support
**Rationale**:
- YAML for better readability and comments support
- Multiple deployment environments in single config file
- Separation of deployment config from environment variables
- Industry standard for configuration files (Docker Compose, GitHub Actions, etc.)

**Current Configuration Structure** (YAML):
```yaml
name: my-app
services:
  - name: app
    type: nuxt
    port: 3000
```

**Planned Enhancement** (Multiple environments):
```yaml
name: my-app
services:
  - name: app
    type: nuxt
    port: 3000

environments:
  development:
    type: local
    compose: ["docker-compose.yml", "docker-compose.dev.yml"]

  staging:
    type: remote
    host: staging.example.com
    compose: ["docker-compose.yml", "docker-compose.staging.yml"]

  production:
    type: remote
    host: example.com
    compose: ["docker-compose.yml", "docker-compose.prod.yml"]
```

## 5. SSL/TLS Strategy

**Decision**: Traefik for reverse proxy + mkcert for local certs
**Rationale**:
- Traefik handles ALL production SSL via Let's Encrypt (Don't Reinvent the Wheel)
- mkcert provides trusted local certificates for dev/prod parity
- We only generate configuration, not manage certificates
- Battle-tested solutions for complex problems

**Local Development**:
```yaml
# docker-compose.dev.yml
services:
  traefik:
    volumes:
      - ./certs:/certs:ro
      - ./.light/traefik:/etc/traefik/dynamic:ro
    command:
      - --providers.file.directory=/etc/traefik/dynamic
```

**Dynamic Configuration** (`.light/traefik/dynamic.yml`):
```yaml
http:
  routers:
    app:
      rule: "Host(`app.lvh.me`)"
      service: app
      tls: true
    # BaaS routes generated when detected
    supabase-api:
      rule: "Host(`api.lvh.me`)"
      service: supabase-api
      tls: true
```

**CLI's Role**:
- Run `mkcert -install` and `mkcert "*.lvh.me"` for local setup
- Generate Traefik dynamic configuration files (not container labels)
- Detect BaaS services and generate appropriate proxy routes
- Let Traefik handle the actual SSL management

## 5. CLI Self-Update Mechanism

**Decision**: update-notifier + npm programmatic API
**Rationale**:
- update-notifier: Non-blocking update checks used by npm, Yeoman
- Respects CI environments automatically
- Can check npm registry for new versions
- Self-update via `npm install -g lightstack-dev/cli@latest`

**Implementation**:
```typescript
// Check for updates on CLI startup
import updateNotifier from 'update-notifier';
const notifier = updateNotifier({ pkg, updateCheckInterval: 86400000 }); // Daily
notifier.notify({ isGlobal: true });

// Self-update command
async function selfUpdate() {
  const { execSync } = require('child_process');
  execSync('npm install -g @lightstack-dev/cli@latest', { stdio: 'inherit' });
}
```

## 6. Supabase Integration Strategy

**Decision**: Complete self-hosted Supabase stack deployment, no command passthrough
**Rationale**:
- Single Responsibility Principle: CLI orchestrates Supabase deployment, doesn't wrap Supabase CLI
- Dev/prod parity: Same SSL domains locally and in production
- Better UX: Subdomains instead of port numbers
- Clear separation: Supabase CLI manages migrations/config, Lightstack deploys the complete stack
- Supabase-only for now: Other BaaS platforms may be added later if demand exists (YAGNI)

**Developer Workflow**:
```bash
# 1. Initialize Supabase project (required)
supabase init              # Initialize Supabase project

# 2. Initialize Lightstack infrastructure
light init my-app          # Create Lightstack configuration

# 3. Start development (auto-detects Supabase and deploys complete stack)
light up                   # Detects supabase/, deploys complete self-hosted stack
```

**Supabase Stack Deployment**:
- **Detection**: Check for `supabase/` directory during `light up`
- **Development Mode**: Proxy to Supabase CLI (`supabase start`) services
- **Production Mode (`light up production`)**: Deploy complete self-hosted Supabase Docker stack locally
- **Remote Deployment (`light deploy`)**: Same stack on remote server
- **Configuration**: Traefik file provider for dev, Docker provider for production
- **Routing**: SSL domains map to Supabase services

**URL Mapping** (when Supabase detected):
```
Development (light up):
https://api.lvh.me      → Supabase CLI API (proxy)
https://studio.lvh.me   → Supabase CLI Studio (proxy)
https://app.lvh.me      → Your dev server (localhost:3000)

Local Production Testing (light up production):
https://app.local.lightstack.dev      → Containerized app (production build)
https://api.local.lightstack.dev      → Supabase API (self-hosted container)
https://studio.local.lightstack.dev   → Supabase Studio (self-hosted container)

Remote Production (light deploy production):
https://yourdomain.com               → Containerized app
https://api.yourdomain.com           → Supabase API (self-hosted)
https://studio.yourdomain.com        → Supabase Studio (self-hosted)
```

**Command Boundaries**: Lightstack CLI only accepts defined commands (init, up, down, deploy, status, logs, env). For Supabase-specific operations (migrations, db push), use Supabase CLI directly.

## 7. CI/CD File Generation

**Decision**: Template-based generation with simple string replacement
**Rationale**:
- YAGNI: Start with basic templating, add complexity only if needed
- Users can understand and modify generated files
- Easy to maintain CI/CD templates as separate files

**Template Structure**:
```
templates/
├── github-actions/
│   └── deploy.yml
├── docker-compose/
│   ├── base.yml
│   ├── dev.yml
│   └── prod.yml
└── traefik/
    └── traefik.yml
```

## 7. Error Handling & Messaging

**Decision**: Centralized error classes with chalk for formatting
**Rationale**:
- Custom error classes for different failure types
- Chalk for color-coded messages (respects NO_COLOR)
- Ora for spinner/progress indicators
- Debug module for verbose logging

**Error Categories**:
- ConfigurationError: Missing or invalid config
- DockerError: Docker not running or unavailable
- NetworkError: Connection issues with retries
- ValidationError: Invalid user input

## 8. Testing Strategy

**Decision**: Vitest for all testing needs
**Rationale**:
- Lightning fast (uses esbuild)
- Native ESM support
- Compatible with Jest API
- Built-in mocking and coverage

**Test Structure**:
```
tests/
├── unit/          # Pure functions, utilities
├── integration/   # CLI commands, Docker operations
└── e2e/           # Full workflow scenarios
```

## 9. Package Management & Distribution

**Decision**: Bun as package manager/runtime, npm registry for distribution
**Rationale**:
- Bun: 10-100x faster than npm for installs and script execution
- Bun: Built-in TypeScript support, no need for tsx/ts-node
- Bun: Compatible with npm packages and package.json
- npm registry: Universal availability for end users
- Supports scoped packages (@lightstack-dev/cli)
- End users can still use npm/yarn/pnpm to install

**Development with Bun**:
```bash
bun install          # Lightning fast dependency installation
bun run dev          # Direct TypeScript execution
bun test            # Native test runner (or Vitest)
bun build           # Bundle for distribution
```

**Release Strategy**:
- Semantic versioning
- Automated releases via GitHub Actions
- Changelog generation from conventional commits
- Publish to npm registry (works with any package manager)

## 10. Platform Compatibility

**Decision**: Node.js 20+ requirement with cross-platform considerations
**Rationale**:
- Node.js 20 is LTS, has native ESM support
- Built-in test runner (though we use Vitest)
- Better performance and security

**Platform-Specific Handling**:
- Windows: Require WSL2 for Docker operations
- macOS: Native Docker Desktop support
- Linux: Direct Docker Engine support

## Key Architecture Decisions

### 1. Simplified Command Structure
Keep it simple - commands do their work directly:
```typescript
// No overengineered service layers
cli/commands/
├── init.ts       # light init
├── up.ts         # light up
├── deploy.ts     # light deploy
└── supabase.ts   # light supabase [passthrough]
```

### 2. Configuration-First Approach
Generate files, then shell out to existing tools:
```typescript
generateDockerCompose() → exec('docker compose up -d')
generateTraefikConfig() → let Traefik handle SSL
generateGithubActions() → let GitHub run deployments
```

### 3. No Plugin System (YAGNI)
Start simple, add complexity only when proven necessary.

## Constitution Compliance Check

✅ **Don't Reinvent the Wheel**: Using Traefik, Docker Compose, mkcert - not building own SSL/orchestration
✅ **Configuration Over Code**: Generate compose files users can understand and modify
✅ **Single Responsibility**: CLI orchestrates, doesn't try to be everything
✅ **Fail Fast, Fail Clearly**: Validate Docker/prerequisites before operations
✅ **Progressive Disclosure**: Smart defaults with override capabilities
✅ **Stand on Shoulders of Giants**: Commander.js, Docker Compose, Traefik, mkcert
✅ **Idempotent Operations**: Can be designed into each command
✅ **Environment Awareness**: Update-notifier respects CI, NO_COLOR support planned

## Unresolved Questions

None - all technical decisions align with constitutional principles:
- Leverage existing tools rather than reimplementing
- Generate configuration for standard tools
- Keep architecture simple and focused

## Next Steps

1. Create conceptual data model (entities and relationships)
2. Define CLI command contracts
3. Generate quickstart guide
4. Set up test harnesses
5. Begin TDD implementation

---
*Research completed: 2025-09-18 (Revised for constitutional compliance)*