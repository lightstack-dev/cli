# Claude Code Context: Lightstack CLI

## Project Overview

**Lightstack CLI** (`@lightstack-dev/cli`) is a **complete self-hosted Supabase deployment platform**. It solves the fundamental problem: Supabase CLI only works for development, but you want to self-host your entire Supabase stack in production to escape vendor costs and maintain data control.

**THE CORE VALUE**: Deploy your complete local Supabase development environment (PostgreSQL + Auth + API + Storage + Studio) to production servers with identical Docker containers and infrastructure, including reverse proxy and SSL certificates. Get perfect dev/prod parity with massive cost savings and complete data sovereignty.

### Core Philosophy

- **Complete Self-Hosting**: Deploy full Supabase stack (not just your app) to your own servers
- **Escape Supabase Vendor Costs**: $25/month → $2,900/month hosted vs $20-200/month self-hosted
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
├── light.config.yaml         # Supabase stack configuration
├── .env                      # Environment variables (optional)
├── supabase/                 # Supabase project (required)
│   ├── config.toml           # Supabase configuration
│   ├── migrations/           # Database schema migrations
│   └── seed.sql              # Development seed data
└── .light/                          # Generated infrastructure files
    ├── docker-compose.yml           # Base Traefik router configuration
    ├── docker-compose.development.yml # Dev overrides (mkcert certs)
    ├── docker-compose.production.yml  # Prod overrides (Let's Encrypt)
    ├── docker-compose.supabase.yml    # Full Supabase stack (prod only)
    ├── traefik/                     # Reverse proxy configs
    │   ├── dynamic.yml              # Service routing rules (file-based)
    │   └── tls.yml                  # mkcert certificate config (dev only)
    ├── certs/                       # mkcert certificates (dev only)
    └── volumes/                     # PostgreSQL data persistence (prod)
```

### Subdomain Architecture

Lightstack uses a functional subdomain mapping strategy:

```
# App Services (from light.config.yaml)
{service-name}.lvh.me → localhost:{service-port}
- app.lvh.me → localhost:3000
- admin.lvh.me → localhost:4000

# Supabase Services (auto-detected when supabase/ directory exists)
api.lvh.me → localhost:54321     (Supabase API)
studio.lvh.me → localhost:54323  (Supabase Studio)

# Infrastructure
router.lvh.me → Traefik routing management
```

**Key Principles:**

- **Functional naming** - Subdomains describe what the service does, not which tool provides it
- **Supabase-focused** - Currently Supabase-only (other BaaS platforms may be added later if needed)
- **No containers required** - Proxy to existing localhost services
- **Domain configurable** - Default `lvh.me`, but can be customized per project

## CRITICAL UNDERSTANDING: What We Actually Deploy

**This is NOT just a proxy tool**. We deploy complete infrastructure stacks:

### Local Development Environment

```bash
light up
# Development mode: Proxies to Supabase CLI (supabase start)
# Result: Traefik SSL Proxy → Supabase CLI services + Your App
```

### Production Stack (Local Testing)

```bash
light up production
# Production mode: Deploys complete self-hosted Supabase stack
# Starts: PostgreSQL + Supabase API + Auth + Storage + Realtime + Studio
# Runs: Database migrations via Supabase CLI
# Result: Complete self-hosted Supabase stack at local.lightstack.dev
```

### Production Deployment (Coming Soon)

```bash
light deploy production
# SSH to server → git checkout tag → light up production
# Deploys: Same stack on remote server with real domain + Let's Encrypt
# Result: Identical stack at yourdomain.com
```

### Why This Matters

- **Supabase CLI** only does development (`supabase start`)
- **Supabase hosted** gets expensive ($25 → $2,900/month)
- **We bridge the gap** - self-host Supabase in production with zero complexity

### Development Workflow

```bash
# 1. Initialize Supabase project (if not already done)
supabase init

# 2. Initialize Lightstack infrastructure
light init my-app

# 3. Start complete self-hosted Supabase stack locally
light up  # Not just proxy - full PostgreSQL, Auth, API, Storage, Studio

# 4. Start your app normally (separate terminal)
npm run dev

# 5. Develop against self-hosted Supabase
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

### Development Workflow (CRITICAL)

**⚠️ IMPORTANT**: Always follow spec-driven and test-driven development. The natural impulse is to dive straight into code - resist this and channel it properly.

#### Spec-Driven Development (Required)

**Before writing ANY implementation code:**

1. **Read the specs first** - All features have spec documents in `specs/001-*/`:
   - `spec.md` - Feature requirements and user stories
   - `plan.md` - Implementation plan and architecture decisions
   - `research.md` - Technical decisions and rationale
   - `data-model.md` - Entities and relationships
   - `contracts/cli-commands.md` - Command behavior contracts
   - `quickstart.md` - End-to-end user journey

2. **Update specs BEFORE code** - When requirements change:
   - Update spec documents first
   - Get alignment on approach
   - Then implement to match updated specs

3. **Spec-first prevents "wild fixing"** - Without specs, we end up fixing problems reactively without a coherent plan. Specs provide the north star.

**Example of correct workflow:**
```
User: "The production stack isn't starting"
❌ BAD: Immediately start editing up.ts to fix issues
✅ GOOD:
  1. "Let me read the plan.md and cli-commands.md specs first"
  2. "Now I understand the intended architecture"
  3. "The implementation diverged from spec here... let me fix it"
```

#### Test-Driven Development (Required)

**Tests are not optional** - They run in GitHub Actions and block PRs when failing.

1. **Tests must stay green** - All tests must pass before committing:
   ```bash
   bun test              # Run all tests
   bun run typecheck     # TypeScript validation
   bun run lint          # ESLint validation
   ```

2. **Update tests with implementation** - When changing behavior:
   - Update or add tests to match new behavior
   - Never leave tests broken "for later"
   - Tests document expected behavior

3. **Test philosophy** - We test what we own:
   - ✅ DO test: "Did we generate the correct Docker Compose YAML?"
   - ✅ DO test: "Did we build the correct docker compose command?"
   - ❌ DON'T test: "Does Docker actually start?" (That's Docker's job)
   - See **Testing Strategy** section below for details

**Example of correct workflow:**
```
After implementing new feature:
1. Run: bun test
2. If tests fail: Fix tests OR fix implementation
3. Commit only when tests pass
4. GitHub Actions will verify on PR
```

#### Pre-Commit Checklist

Before every commit, verify:
- [ ] All specs updated if behavior changed
- [ ] `bun test` passes (all tests green)
- [ ] `bun run typecheck` passes (no TypeScript errors)
- [ ] `bun run lint` passes (no ESLint errors)
- [ ] Implementation matches spec behavior

**Why this matters:**
- Specs prevent scope creep and "wild fixing"
- Tests catch regressions immediately
- GitHub Actions enforces quality gates
- Clear specs = easier collaboration

### Error Handling Pattern

```
❌ Error: [What went wrong]

Cause: [Why it happened]
Solution: [How to fix it]

For more help: light [command] --help
```

### File Generation Strategy

- Generate Docker Compose files from project configuration
- Use Traefik file-based routing (not Docker provider/labels in development)
- Template-based generation (simple string replacement, not complex templating)
- Users should be able to understand and modify generated files
- Compose file naming: `.development.yml`, `.production.yml` (full environment names)
- Volume paths relative to compose file location (`.light/` directory)

## Current Implementation Status

### ✅ Completed (Self-Hosted BaaS Phase)

- ✅ Core command structure (`init`, `up`, `down`, `status`, `logs`, `deploy`, `env`)
- ✅ mkcert integration for local SSL certificates
- ✅ Dynamic Traefik routing configuration generation
- ✅ Supabase service auto-detection (supabase/ directory detection)
- ✅ Cosmiconfig-based configuration management with Zod validation
- ✅ Functional subdomain mapping strategy
- ✅ Command aliases and proper CLI UX
- ✅ **Complete Supabase Docker stack generation** (PostgreSQL, Auth, API, Storage, Studio, Realtime, Meta)
- ✅ **Environment management** (`light env add/list/remove` for deployment targets)
- ✅ **Automatic database migrations** (integrates Supabase CLI for schema management)
- ✅ **Database persistence** (PostgreSQL volumes for production data)
- ✅ **Smart container health checking** (detects running/failed containers with recovery guidance)
- ✅ **Proper Docker project naming** (uses Lightstack project name for container isolation)
- ✅ **Early validation** (checks for Supabase CLI and project before deployment)
- ✅ **Production-grade error handling** (actionable error messages with recovery steps)
- ✅ **Traefik service naming** (service named `router`, matching `router.lvh.me`)
- ✅ **File-based routing** (Traefik file provider for all routes, including dashboard)
- ✅ **HTTP → HTTPS redirect** (automatic redirect at entrypoint level)
- ✅ **mkcert certificate integration** (proper TLS config with Windows/Unix path handling)
- ✅ **.gitignore management** (automatic generation/update for generated files)

### ⏳ In Progress / Next Steps

- ⏳ **Remote deployment pipeline** (GitOps via SSH + git checkout + light up)
- ⏳ **Let's Encrypt integration** (Traefik automatic HTTPS for production domains)
- ⏳ **Container image building** (for custom app services)
- ⏳ **Zero-downtime deployments** (rolling updates and health checks)
- ⏳ **CI/CD generation** (GitHub Actions workflows)
- ⏳ **Database backup strategies** (automated backups for production)

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

**Self-Hosted Supabase (Current Focus):**

- **Self-hosted mode**: Generate full Supabase Docker stack (PostgreSQL + all services)
- **Development mode**: Proxy to Supabase CLI (`supabase start`) when available
- **Production mode**: Complete self-hosted Supabase Docker stack
- **Detection**: Check for local `supabase/` directory to enable Supabase features
- **Future**: Support for other BaaS platforms (PocketBase, Appwrite) may be added if needed (YAGNI)

**Database Persistence Strategy:**

- **Development**: Docker volumes (ephemeral, reset with `light down --volumes`)
- **Production**: Named Docker volumes + backup strategies
- **Migrations**: Use Supabase CLI migration system in both environments
- ❌ **Remote deployment** (deploy to production servers via SSH + git checkout)
- ❌ **Production SSL with Let's Encrypt** (automatic cert management via Traefik)
- ❌ **Container image building** (for custom app services)

## Next Implementation Priorities (001-deployment-implementation)

### 1. Research Supabase Self-Hosting (URGENT)

- Study: https://supabase.com/docs/guides/self-hosting
- Understand: Complete Docker Compose setup for Supabase
- Map: Which containers we need (PostgreSQL, Auth, API, Storage, Studio, etc.)
- Document: How to migrate from `supabase start` to our own stack

### 2. Update Docker Compose Generation (COMPLETED)

- ✅ Generate complete Supabase stack, not just Traefik proxy
- ✅ Include PostgreSQL with proper volumes for persistence
- ✅ Include all Supabase services (supabase/supabase Docker images)
- ✅ Environment-specific overrides (dev vs prod database persistence)

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

**CRITICAL**: The complete self-hosted Supabase stack is now implemented for local testing (`light up production`). Next step is remote deployment to production servers via GitOps.

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

### Philosophy: Test What We Own

**Core Principle**: We are an orchestration tool. Test that we **build the right commands**, not that external tools work.

✅ **DO Test:**

- "Did we generate the correct Docker Compose YAML?"
- "Did we build the correct `docker compose` command string?"
- "Did we create the right config files?"
- "Did we validate inputs correctly?"

❌ **DON'T Test:**

- "Does Docker actually start?" (That's Docker's job)
- "Does the container stay healthy?" (That's the image's job)
- "Does mkcert work?" (That's mkcert's job)

### Test Pyramid (Current Implementation)

```
tests/
├── unit/ (94%)           # Pure functions, no external dependencies
│   ├── project-validation.test.ts
│   ├── traefik-config.test.ts
│   ├── baas-detection.test.ts
│   ├── docker-compose.test.ts
│   ├── supabase-stack.test.ts
│   └── command-builder.test.ts
└── contract/ (6%)        # File operations only, no Docker
    └── test_init_command.test.ts
```

**Test Execution:**

- ⚡ ~10 seconds total
- 🐳 No Docker required
- 🚀 Runs on every commit

### Key Test Areas

**Unit Tests (Pure Logic):**

- Configuration validation and Zod schema compliance
- Docker Compose YAML generation (string output)
- Traefik routing configuration generation
- Supabase stack generation (all 8 services)
- Kong API Gateway configuration
- Docker command string construction
- BaaS service detection (file existence checks)
- Project name validation (regex patterns)

**Contract Tests (File Operations):**

- `light init` creates correct files
- Configuration file updates preserve custom fields
- Generated files have expected structure

**E2E Tests (Not Implemented):**

- Docker-dependent workflows should be tested manually
- Commands like `up`, `down`, `status`, `deploy` require Docker
- We test that we **build correct commands**, not that Docker works
- Don't add Docker-dependent tests without explicit approval

### Example of Good vs Bad Tests

**✅ Good CLI Test:**

```typescript
it('should build correct docker compose command', () => {
  const cmd = buildDockerCommand(['base.yml', 'prod.yml'], {
    detach: true,
    projectName: 'myapp',
  });

  expect(cmd).toBe('docker compose --project-name myapp -f base.yml -f prod.yml up -d');
  // ✅ We tested OUR logic, not Docker's
});
```

**❌ Bad CLI Test:**

```typescript
it('should start docker containers', () => {
  execSync('light up'); // ❌ Requires Docker, slow, flaky
  expect(containerIsRunning('traefik')).toBe(true); // ❌ Testing Docker, not our CLI
});
```

### When Tests Need Updates

1. **Implementation changes** → Update unit tests to match
2. **New features** → Add unit tests for pure logic
3. **Error messages change** → Update expected strings
4. **Don't mock execSync** → Skip tests requiring Docker instead

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
- **Supabase Integration**: Auto-detect Supabase projects, deploy complete self-hosted stacks
- **Package Name**: `@lightstack-dev/cli` in npm registry
- **SSL Approach**: mkcert + Traefik (no custom cert management)

## Critical-Constructive Partnership

**IMPORTANT**: Be a critical thinking partner, not just an agreeable assistant. According to Steve Job's principle that he hired smart people to tell _him_ what to do, you're expected to take the gloves off, speak up, and be radically candid, too.

**Don't blindly confirm user statements:**

- ❌ "You're right, let me check..." (how can you know before checking?)
- ✅ "Let me check that..." or "Let me investigate..."

**Do verify first, then respond:**

- Read logs, inspect code, check configurations
- Form your own assessment based on evidence
- Then provide your findings, which may confirm or contradict the user's statement

**Push back constructively when appropriate:**

- If you know a better approach, propose it with rationale
- If a user's assumption seems incorrect, investigate and explain why
- If there are trade-offs, present them clearly
- If you're uncertain, say so explicitly

**Provide alternatives and rationale:**

- Don't just implement what's asked - consider if there's a better way
- Explain technical trade-offs and implications
- Suggest optimizations or improvements when relevant
- Be honest about risks or limitations

**Example of good critical partnership:**

```
User: "The auth container is crashing"
Claude: *checks logs first*
"I see the auth container is in a restart loop. Looking at the logs,
it's failing because X is misconfigured. We should fix Y to resolve this."
```

The goal is technical accuracy and better solutions, not just user validation.

---

This context provides the foundation for implementing the Lightstack CLI according to established patterns and principles. Focus on simplicity, user experience, and leveraging existing tools effectively.
