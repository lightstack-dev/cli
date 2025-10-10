# Claude Code Context: Lightstack CLI

## Project Overview

**⚠️ PRE-RELEASE STATUS**: This CLI has not been released yet (no v1.0.0). Breaking changes are expected and acceptable. Don't worry about backward compatibility - we can break anything that needs fixing.

**Lightstack CLI** (`@lightstack-dev/cli`) automates self-hosting complete Supabase stacks in production. Escape Supabase Cloud costs ($25→$2,900/month) by deploying the full stack (PostgreSQL, Auth, API, Storage, Studio) to your own servers ($20-200/month) with perfect dev/prod parity.

### Core Value Proposition

- **Complete Self-Hosting**: Deploy full Supabase stack to your servers, not just your app
- **Cost Savings**: 90%+ reduction vs Supabase Cloud at scale
- **Perfect Dev/Prod Parity**: Identical Docker containers from localhost to production
- **GitOps Deployment**: Deploy via git tags, rollback via git checkout
- **Data Sovereignty**: Your database, your servers, your control

## Commands & Workflows

### Development Workflow
```bash
# Development mode: Proxy to Supabase + your app
light init          # Initialize Lightstack infrastructure
light up            # Start Traefik proxy (proxies to supabase start + your app)
npm run dev         # Start your app separately

# Access via HTTPS:
# https://app.lvh.me → Your app (localhost:3000)
# https://api.lvh.me → Supabase API
# https://studio.lvh.me → Supabase Studio
```

### Deployment Workflow (Planned)
```bash
# Local testing mode: Full containerized stack including app
light up production  # Test full stack locally before deploying

# Remote deployment: GitOps to production server
git tag v1.0.0 && git push --tags
light deploy production --tag v1.0.0
# → SSH to server → git checkout v1.0.0 → light up production
```

### Environment Management
```bash
light env add staging      # Add deployment target
light env list             # Show all environments
light env remove staging   # Remove deployment target
```

### Monitoring
```bash
light status              # Show infrastructure status
light logs [service]      # View service logs
light down               # Stop infrastructure
```

## Architecture

### Two Distinct Modes

**CRITICAL UNDERSTANDING**: Development ≠ Deployment

1. **Development Mode** (`light up`):
   - Traefik proxy only (no app containerization)
   - Proxies to Supabase CLI (`supabase start`)
   - Proxies to your app running via `npm run dev`
   - mkcert SSL certificates

2. **Deployment Mode** (`light up <env>`):
   - Full containerized stack (Traefik + Supabase + **your app**)
   - Self-hosted Supabase (PostgreSQL, Auth, API, Storage, Studio, Realtime)
   - **App containerization** (NOT YET IMPLEMENTED - see #6)
   - Let's Encrypt SSL (production) or mkcert (local testing)

**Current Issue**: These modes are mingled in implementation. Needs clear separation (see Spec 002).

### File Structure
```
project-root/
├── light.config.yaml              # Supabase stack configuration
├── supabase/                      # Supabase project (required)
│   ├── config.toml
│   └── migrations/
└── .light/                        # Generated infrastructure
    ├── docker-compose.yml         # Base Traefik config
    ├── docker-compose.development.yml
    ├── docker-compose.production.yml
    ├── docker-compose.supabase.yml
    ├── traefik/
    │   ├── dynamic.yml            # Service routing (file-based)
    │   └── tls.yml                # mkcert certs (dev only)
    └── certs/                     # mkcert certificates
```

### Technology Stack
- **Language**: TypeScript/Node.js 20+
- **Package Manager**: Bun (not npm/yarn/pnpm)
- **CLI Framework**: Commander.js
- **Config**: Cosmiconfig + Zod validation
- **Docker**: Shell out to `docker compose` (not Docker SDK)
- **SSL**: Traefik + mkcert (dev) / Let's Encrypt (prod)
- **Testing**: Vitest

## Implementation Guidelines

### Constitutional Principles
1. **Don't Reinvent the Wheel**: Orchestrate existing tools (Docker, Supabase CLI, Traefik)
2. **Configuration Over Code**: Generate configs, let tools do their job
3. **Single Responsibility**: CLI orchestrates; doesn't become Swiss Army knife
4. **Fail Fast, Fail Clearly**: Validate early; provide actionable errors
5. **Progressive Disclosure**: Smart defaults; allow overrides

### Development Workflow

**⚠️ CRITICAL**: Follow spec-driven and test-driven development.

1. **Read specs first** - Understand intended architecture before coding
   - Specs live in `specs/00X-name/` (spec.md, plan.md, tasks.md)
   - When fixing issues, check if implementation diverged from spec

2. **Update specs before code** - When requirements change:
   - Update spec documents first
   - Then implement to match

3. **Tests must pass** - Before every commit:
   ```bash
   bun test              # All tests must pass
   bun run typecheck     # No TypeScript errors
   bun run lint          # No ESLint errors
   ```

### Testing Strategy

**Philosophy**: Test what we own, not external tools.

✅ **DO Test**:
- "Did we generate correct Docker Compose YAML?"
- "Did we build correct `docker compose` command?"
- "Did we validate inputs correctly?"

❌ **DON'T Test**:
- "Does Docker actually start?" (That's Docker's job)
- "Does mkcert work?" (That's mkcert's job)

**Current Distribution**:
- 94% unit tests (pure logic, no Docker)
- 6% contract tests (file operations only)
- 0% E2E tests (manual testing for Docker integration)

**Example**:
```typescript
✅ Good: Test command building
expect(buildDockerCmd(['base.yml'], { detach: true }))
  .toBe('docker compose -f base.yml up -d');

❌ Bad: Test Docker execution
execSync('light up'); // Requires Docker, slow, flaky
expect(containerIsRunning('traefik')).toBe(true);
```

### Error Handling Pattern
```
❌ Error: [What went wrong]

Cause: [Why it happened]
Solution: [How to fix it]

For more help: light [command] --help
```

### File Generation
- Docker Compose files from project config
- Traefik file-based routing (not Docker labels - more debuggable)
- Simple string replacement (no complex templating)
- Users should be able to read and modify generated files
- Compose file naming: `.development.yml`, `.production.yml`

## Current Status

### ✅ Implemented (Spec 001)
- Core commands (`init`, `up`, `down`, `status`, `logs`, `env`)
- Complete Supabase Docker stack generation
- Traefik reverse proxy with file-based routing
- mkcert SSL integration (local dev)
- Environment management
- Automatic database migrations (Supabase CLI integration)
- Smart container health checking
- Production-grade error handling
- .gitignore management

### 🚧 Next Priorities (GitHub Backlog)
- **#6**: App containerization for deployment testing (CRITICAL - blocks release)
- **#4**: Remote SSH deployment (GitOps)
- **#5**: Let's Encrypt SSL automation
- **#7**: Console output formatting system
- **#8**: Database backup strategies
- **#9**: CI/CD workflow generation
- **#10**: Zero-downtime deployments

See all issues: https://github.com/lightstack-dev/cli/issues

## Spec Management (Lessons Learned)

### What Works
- **Small specs**: 10-15 tasks, ship in days
- **GitHub issues as backlog**: Long-term ideas go there, not in spec
- **Spec = snapshot**: Documents what we're building NOW
- **Retroactive updates**: Update specs after validating implementation

### What Doesn't Work
- **Large specs**: 100+ tasks = waterfall planning fantasy
- **Spec as backlog**: Tasks.md is not the project TODO list
- **Spec as contract**: Implementation teaches us; specs should document learnings

### Workflow (Established)
1. Plan focused spec (10-15 tasks)
2. Implement and learn
3. Update spec with learnings
4. Merge to main
5. Start next spec

**Current**: Closed Spec 001, created GitHub backlog (#4-#16), ready for Spec 002.

## Critical-Constructive Partnership

**IMPORTANT**: Be a critical thinking partner, not agreeable assistant.

**Don't blindly confirm**:
- ❌ "You're right, let me check..." (how do you know before checking?)
- ✅ "Let me investigate..." (check first, then confirm/contradict)

**Do push back constructively**:
- Propose better approaches with rationale
- Explain technical trade-offs clearly
- Be honest about risks and limitations
- Say explicitly when uncertain

**Goal**: Technical accuracy and better solutions, not user validation.

---

**Recent Context**: Just closed Spec 001 (merged to main). Created GitHub backlog for deferred work. Planning Spec 002 focused on dev/deployment workflow separation.
