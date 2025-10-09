# Feature Specification: Lightstack CLI Core Foundation

**Feature Branch**: `001-initial-lightstack-cli`
**Created**: 2025-09-18
**Status**: ✅ MERGED (2025-10-09)

## Status: CLOSED (Merged to main)

### What We Shipped ✅
- Complete Supabase self-hosted stack generation (PostgreSQL, Auth, API, Storage, Studio, Realtime)
- Traefik reverse proxy with file-based routing
- mkcert SSL certificate integration for local development
- Environment management (`light env add/list/remove`)
- Automatic database migrations via Supabase CLI integration
- Production-grade error handling with actionable recovery steps
- Smart container health checking and recovery
- File-based Traefik configuration (no Docker labels)
- HTTP → HTTPS automatic redirects
- .gitignore management for generated files
- Core commands: `init`, `up`, `down`, `status`, `logs`, `env`

### What We Deferred 🚧
Moved to backlog (see GitHub issues):
- **App containerization** for deployment testing (#6)
- **Remote SSH deployment** (#4)
- **Let's Encrypt SSL automation** (#5)
- **Zero-downtime deployments** (#10)
- **CI/CD workflow generation** (#9)
- **Database backup strategies** (#8)
- **Console output formatting system** (#7)

### Key Learnings 📚

**Architecture Discovery**:
- Development mode ≠ Deployment mode (needs clear separation)
- `light up` → Proxy to localhost (no containerization)
- `light up <env>` → Full stack with containerized app (NOT implemented yet)
- This distinction became clear during implementation

**Testing Approach**:
- Started with TDD plan requiring Docker-dependent tests
- Pivoted to "test what we own" philosophy
- Final: 94% unit tests (pure logic), 6% contract tests (file ops only)
- No E2E tests - we test command building, not Docker execution

**Spec Management**:
- 100+ tasks in one spec = too large
- Spec grew endlessly without separate backlog
- Learning: Ship smaller increments, use GitHub issues for backlog

**What Worked**:
- Docker Compose generation from config
- Supabase service auto-detection
- Smart defaults with override capability
- File-based Traefik routing (more debuggable than labels)

**What Needs Improvement**:
- Dev vs deployment workflow separation (see Spec 002)
- Console output consistency (free-styling everywhere)
- ACME/SSL process integration (partial implementation)

---

## Original Specification (Reference)

### Primary User Story
As a developer working with Supabase, I need a CLI tool that enables me to self-host my entire Supabase stack (database, auth, API, storage) both locally and in production, escaping Supabase's vendor pricing and high costs while maintaining perfect dev/prod parity and complete data sovereignty.

### Acceptance Scenarios
1. ✅ **Given** a new project folder with Supabase initialized, **When** developer runs initialization command, **Then** the CLI creates configuration for self-hosted Supabase stack with production-grade SSL
2. ✅ **Given** an initialized Lightstack project, **When** developer runs development command, **Then** complete self-hosted Supabase stack starts (PostgreSQL, Auth, API, Storage, Studio) with HTTPS proxy
3. 🚧 **Given** a project with self-hosted Supabase, **When** developer deploys to production, **Then** identical Supabase stack deploys to remote server with Let's Encrypt SSL (deferred to #4, #5)
4. 🚧 **Given** a production deployment, **When** deployment completes, **Then** all Supabase services accessible via HTTPS with automatic health checks and rollback capability (partial - health checks yes, rollback #10)
5. 🚧 **Given** a need to escape Supabase vendor costs, **When** developer switches from hosted Supabase to self-hosted, **Then** data migration and identical functionality preserved (deferred to future spec)

### Requirements Summary
- **Implemented**: FR-001 to FR-003, FR-005 to FR-007, FR-009 to FR-013, FR-015, FR-017, FR-022 to FR-025, FR-027 to FR-028
- **Deferred**: FR-004, FR-008, FR-014, FR-016, FR-018 to FR-021, FR-026, FR-029, FR-030

---

**Next**: See [Spec 002](../002-dev-deployment-separation/) for dev/deployment workflow separation
