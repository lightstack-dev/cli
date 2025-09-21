# Claude Code Context: Lightstack CLI

## Project Overview

**Lightstack CLI** (`@lightstack-dev/cli`) is a development-to-production infrastructure orchestrator that bridges localhost and production with identical patterns. It provides production-grade infrastructure in development (HTTPS, reverse proxy, service routing) and deploys with the same infrastructure to production, ensuring perfect dev/prod parity.

### Core Philosophy
- **Dev/Prod Parity**: Identical infrastructure patterns from localhost to production
- **Don't Reinvent the Wheel**: Use Traefik for SSL, Docker Compose for orchestration, mkcert for local certs
- **Configuration Over Code**: Generate files users can understand and modify
- **Infrastructure as Code**: Production-grade patterns that scale from dev to enterprise

## Current Architecture

### Command Structure
```
light init [project-name]    # Initialize development/production infrastructure
light up                     # Start production-grade local environment
light status                 # Show infrastructure and service status
light logs [service]         # Show infrastructure logs
light down                   # Stop local infrastructure
light deploy [environment]   # Deploy with identical infrastructure to production
```

### Technology Stack
- **Language**: TypeScript/Node.js 20+
- **CLI Framework**: Commander.js
- **Docker**: Shell out to `docker compose` commands
- **SSL**: Traefik (production) + mkcert (local development)
- **Testing**: Vitest
- **Distribution**: npm registry as `@lightstack-dev/cli`

### File Structure
```
project-root/
├── light.config.yaml         # Main proxy configuration
├── .env                      # Environment variables (optional)
└── .light/                   # Generated proxy files
    ├── docker-compose.yml    # Traefik service only
    ├── docker-compose.dev.yml # Development overrides
    ├── traefik/              # Dynamic routing configs
    │   ├── dynamic.yml       # Service routing rules
    │   └── tls.yml           # SSL certificate config
    └── certs/                # mkcert certificates
```

### Subdomain Architecture

Lightstack uses a functional subdomain mapping strategy:

```
# App Services (from light.config.yaml)
{service-name}.lvh.me → localhost:{service-port}
- app.lvh.me → localhost:3000
- admin.lvh.me → localhost:4000

# BaaS Services (auto-detected)
api.lvh.me → localhost:54321     (Supabase API)
studio.lvh.me → localhost:54323  (Supabase Studio)

# Infrastructure
router.lvh.me → Traefik routing management
```

**Key Principles:**
- **Functional naming** - Subdomains describe what the service does, not which tool provides it
- **Tool agnostic** - Switch from Supabase to Firebase, URLs stay predictable
- **No containers required** - Proxy to existing localhost services
- **Domain configurable** - Default `lvh.me`, but can be customized per project

### Development Workflow

```bash
# 1. Initialize production-grade infrastructure config
light init my-app

# 2. Start production-grade local environment
light up

# 3. Start your app normally (separate terminal)
npm run dev

# 4. Develop with production patterns
# https://app.lvh.me → your app (same URL structure as prod)
# https://router.lvh.me → infrastructure dashboard
# https://api.lvh.me → backend services (same routing as prod)
```

### Production Deployment

```bash
# 5. Deploy with identical infrastructure
light deploy production

# Same Traefik config, same SSL approach, same routing
# What works in dev works in production
```

## Implementation Guidelines

### Constitutional Principles
1. **Don't Reinvent the Wheel**: If a tool does it well, orchestrate it
2. **Configuration Over Code**: Generate configs for existing tools
3. **Single Responsibility**: CLI orchestrates; doesn't become Swiss Army knife
4. **Fail Fast, Fail Clearly**: Validate prerequisites; provide actionable errors
5. **Progressive Disclosure**: Smart defaults; allow overrides

### Error Handling Pattern
```
❌ Error: [What went wrong]

Cause: [Why it happened]
Solution: [How to fix it]

For more help: light [command] --help
```

### File Generation Strategy
- Generate Docker Compose files from project configuration
- Use Traefik labels for routing and SSL
- Template-based generation (simple string replacement, not complex templating)
- Users should be able to understand and modify generated files

## Current Implementation Status

### Completed (Implementation Phase)
- ✅ All core commands (`init`, `up`, `down`, `status`, `logs`, `deploy`)
- ✅ Local proxy architecture (Traefik container only)
- ✅ mkcert integration for local SSL certificates
- ✅ Dynamic Traefik routing configuration generation
- ✅ BaaS service auto-detection and proxying (Supabase)
- ✅ Cosmiconfig-based configuration management with Zod validation
- ✅ Functional subdomain mapping strategy
- ✅ Command aliases (`start`, `stop`, `ps`)

### Key Design Decisions Made
- **Local Development**: Proxy to localhost, no app containerization required
- **Docker Compose**: Generate Traefik-only configs (not Dockerode SDK)
- **SSL Strategy**: mkcert for local, Traefik handles all routing
- **No App Containers**: Developers use existing `npm run dev` workflow
- **Functional Subdomains**: `api.lvh.me`, `studio.lvh.me`, `router.lvh.me`
- **BaaS Integration**: Auto-detect and proxy, don't wrap CLIs

### Architecture Evolution
The CLI evolved from complex orchestration to **focused dev/prod parity**:
- **Before**: Tried to be everything - complex builds, multiple deployment targets
- **After**: Dev/prod infrastructure consistency with production-grade local development
- **Core insight**: Developers need production patterns in development, then identical deployment

## Common Patterns

### Command Validation Flow
```typescript
1. Check prerequisites (Docker running, project exists)
2. Validate configuration and inputs
3. Generate necessary files
4. Execute shell commands
5. Provide clear success/error feedback
```

### Configuration Management
- Use cosmiconfig for flexible config discovery
- JSON Schema validation for configuration
- Environment-specific overrides
- Preserve user customizations during updates

## Testing Strategy

### Decided Approach: Unit Tests Only
After extensive evaluation, we've decided to focus solely on unit tests for pure functions. Here's why:

**What we test:**
- Project name validation logic
- Docker Compose YAML generation
- Traefik configuration generation
- BaaS service detection logic

**What we DON'T test:**
- CLI binary execution (smoke tests)
- Docker orchestration (integration tests)
- Full workflows (e2e tests)

**Rationale:**
- Unit tests catch logic bugs in code we actually wrote
- CLI/Docker tests mostly validate that Node.js and Docker work
- Real functionality requires manual testing with actual Docker environments
- Maintenance overhead of complex CI tests outweighs benefits

### Test Structure
```
tests/
└── unit/          # Pure functions only
    ├── project-validation.test.ts
    ├── docker-compose.test.ts
    ├── traefik-config.test.ts
    └── baas-detection.test.ts
```

### Manual Testing Required
- Full `light init → up → down` workflow
- Docker Compose file validity
- Traefik routing and SSL
- BaaS service integration
- Cross-platform CLI execution

## Dependencies to Use

### Confirmed Choices
- **commander**: CLI framework and argument parsing
- **cosmiconfig**: Configuration file discovery
- **chalk**: Terminal colors (respects NO_COLOR)
- **ora**: Progress spinners and status
- **update-notifier**: Self-update checking
- **execa**: Shell command execution

### Avoid These
- Complex templating engines (use simple string replacement)
- Docker SDK libraries (shell out to docker compose)
- Custom SSL implementations (use mkcert + Traefik)
- Plugin frameworks (YAGNI for MVP)

## Recent Changes & Context

### Major Architecture Shift (Latest)
- **Dev/Prod Parity Focus**: Infrastructure consistency from localhost to production
- **Production-Grade Local Development**: HTTPS, reverse proxy, service routing in dev
- **Simplified Local Workflow**: No app containerization required, proxy existing localhost
- **Deployment Ready**: Full production deployment with identical infrastructure patterns

### Earlier Decisions
- **CLI Name**: Changed from `lightstack` to `light` for better typing experience
- **BaaS Integration**: Auto-detect and proxy, don't wrap other CLIs (Supabase, etc.)
- **Package Name**: `@lightstack-dev/cli` in npm registry
- **SSL Approach**: mkcert + Traefik (no custom cert management)

---

This context provides the foundation for implementing the Lightstack CLI according to established patterns and principles. Focus on simplicity, user experience, and leveraging existing tools effectively.