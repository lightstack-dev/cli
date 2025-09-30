# Claude Code Context: Lightstack CLI

## Project Overview

**Lightstack CLI** (`@lightstack-dev/cli`) is a **complete self-hosted BaaS deployment platform**. It solves the fundamental problem: Supabase CLI only works for development, but you want to self-host your entire BaaS stack in production to escape vendor costs and maintain data control.

**THE CORE VALUE**: Deploy your complete local Supabase development environment (PostgreSQL + Auth + API + Storage + Studio) to production servers with identical Docker containers and infrastructure. Perfect dev/prod parity with massive cost savings and complete data sovereignty.

### Core Philosophy
- **Complete Self-Hosting**: Deploy full Supabase stack (not just your app) to your own servers
- **Escape BaaS Vendor Costs**: $25/month → $2,900/month hosted vs $20-200/month self-hosted
- **Perfect Dev/Prod Parity**: Identical Docker containers from development to production
- **GitOps Deployment**: Deploy via git tags, rollback via git checkout
- **Infrastructure as Code**: All configuration in version control, no clickops

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
- **Package Manager**: Bun (not npm/yarn/pnpm)
- **CLI Framework**: Commander.js
- **Docker**: Shell out to `docker compose` commands
- **SSL**: Traefik (production) + mkcert (local development)
- **Testing**: Vitest
- **Distribution**: npm registry as `@lightstack-dev/cli`

### File Structure
```
project-root/
├── light.config.yaml         # BaaS stack configuration
├── .env                      # Environment variables (optional)
├── supabase/                 # Supabase project (if using Supabase)
│   ├── config.toml           # Supabase configuration
│   ├── migrations/           # Database schema migrations
│   └── seed.sql              # Development seed data
└── .light/                   # Generated infrastructure files
    ├── docker-compose.yml    # Complete BaaS stack + app + proxy
    ├── docker-compose.dev.yml # Development overrides
    ├── docker-compose.prod.yml # Production overrides
    ├── traefik/              # Reverse proxy configs
    │   ├── dynamic.yml       # Service routing rules
    │   └── tls.yml           # SSL certificate config
    ├── certs/                # mkcert certificates (dev only)
    └── volumes/              # PostgreSQL data persistence (prod)
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

## CRITICAL UNDERSTANDING: What We Actually Deploy

**This is NOT just a proxy tool**. We deploy complete infrastructure stacks:

### Local Development Environment
```bash
light up
# Starts: PostgreSQL + Supabase API + Supabase Auth + Supabase Storage +
#         Supabase Studio + Traefik SSL Proxy + Your App Proxy
# Result: Complete self-hosted BaaS stack identical to production
```

### Production Deployment Environment
```bash
light deploy production
# SSH to server → git checkout tag → light up --env production
# Deploys: Same PostgreSQL + Same Supabase services + Same Traefik + Your App
# Result: Identical stack, different domain (yourdomain.com vs lvh.me)
```

### Why This Matters
- **Supabase CLI** only does development (`supabase start`)
- **Supabase hosted** gets expensive ($25 → $2,900/month)
- **We bridge the gap** - self-host Supabase in production with zero complexity

### Development Workflow

```bash
# 1. Initialize complete BaaS infrastructure
light init my-app

# 2. Start complete self-hosted BaaS stack locally
light up  # Not just proxy - full PostgreSQL, Auth, API, Storage, Studio

# 3. Start your app normally (separate terminal)
npm run dev

# 4. Develop against self-hosted BaaS
# https://app.lvh.me → your app
# https://api.lvh.me → your self-hosted Supabase API
# https://studio.lvh.me → your self-hosted Supabase Studio
# All identical to production, just different domains
```

### Production Deployment (GitOps)

```bash
# 5. Tag your release
git tag v1.0.0 && git push --tags

# 6. Deploy to production server
light deploy production --tag v1.0.0

# What happens:
# → SSH to production server
# → git checkout v1.0.0
# → light up --env production
# → Same containers, same stack, production domain + Let's Encrypt SSL
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

### Completed (Foundation Phase)
- ✅ Core command structure (`init`, `up`, `down`, `status`, `logs`, `deploy`)
- ✅ mkcert integration for local SSL certificates
- ✅ Dynamic Traefik routing configuration generation
- ✅ BaaS service auto-detection (Supabase config detection)
- ✅ Cosmiconfig-based configuration management with Zod validation
- ✅ Functional subdomain mapping strategy
- ✅ Command aliases and proper CLI UX

### Missing (Core Value - Self-Hosted BaaS Deployment)
- ❌ **Complete Supabase Docker stack generation** (PostgreSQL, Auth, API, Storage, Studio)
- ❌ **Production deployment pipeline** (GitOps via SSH + git checkout + light up)
- ❌ **Database persistence** (PostgreSQL volumes and backup strategies)
- ❌ **Let's Encrypt integration** (Traefik automatic HTTPS for production domains)
- ❌ **Optional self-hosting** (support both self-hosted and hosted BaaS modes)

### Critical Architecture Decisions for Future Implementation

**Deployment Strategy (GitOps, not file transfer):**
```bash
# Local:
light deploy production --tag v1.2.3

# What happens on production server:
ssh user@server
cd /opt/myapp
git checkout v1.2.3
light up --env production  # Same command, different environment
```

**Self-Hosted vs Hosted BaaS (User Choice):**
- **Self-hosted mode**: Generate full Supabase Docker stack (PostgreSQL + all services)
- **Hosted mode**: Proxy to external Supabase/Firebase (current implementation)
- **Detection**: Check for local `supabase/` directory vs external API endpoints

**Database Persistence Strategy:**
- **Development**: Docker volumes (ephemeral, reset with `light down --volumes`)
- **Production**: Named Docker volumes + backup strategies
- **Migrations**: Use Supabase CLI migration system in both environments
- ❌ **Full BaaS stack in local development** (currently just proxy detection)
- ❌ **Production SSL with Let's Encrypt** (automatic cert management via Traefik)
- ❌ **Migration handling** (Supabase schema migrations in production)

### Current Gap: We're Still Just a Proxy Tool
**Problem**: Right now we only proxy to `supabase start` (external Supabase CLI)
**Need**: We must deploy the complete self-hosted Supabase Docker stack ourselves
**Why**: This is our core value - Supabase CLI doesn't do production, we do

## Next Implementation Priorities (001-deployment-implementation)

### 1. Research Supabase Self-Hosting (URGENT)
- Study: https://supabase.com/docs/guides/self-hosting
- Understand: Complete Docker Compose setup for Supabase
- Map: Which containers we need (PostgreSQL, Auth, API, Storage, Studio, etc.)
- Document: How to migrate from `supabase start` to our own stack

### 2. Update Docker Compose Generation
- Generate complete BaaS stack, not just Traefik proxy
- Include PostgreSQL with proper volumes for persistence
- Include all Supabase services (supabase/supabase Docker images)
- Environment-specific overrides (dev vs prod database persistence)

### 3. Implement GitOps Deployment
- SSH connection and git checkout on remote servers
- Remote execution of `light up --env production`
- Rollback via `git checkout previous-tag`
- Health checks and deployment validation

### 4. Database Persistence Strategy
- PostgreSQL volume mounting for production
- Backup and restore procedures
- Migration handling (apply Supabase migrations to production DB)
- Data seeding for development vs production

**CRITICAL**: Until we deploy the complete self-hosted BaaS stack, we're just an expensive proxy tool. The real value is in the self-hosting automation.

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

### Test Structure
```
tests/
├── unit/          # Pure functions, utilities
├── integration/   # Command execution, file generation
└── e2e/           # Full workflow scenarios
```

### Key Test Areas
- Configuration validation and schema compliance
- Docker Compose file generation accuracy
- Command flag parsing and validation
- Error handling and user messaging
- File system operations and cleanup

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