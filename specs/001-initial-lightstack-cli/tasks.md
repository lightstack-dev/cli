# Tasks: Lightstack CLI Core Foundation

**Input**: Design documents from `/specs/001-initial-lightstack-cli/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

---

## ⚠️ TESTING APPROACH UPDATE (2025-01)

**Original spec** called for TDD with contract tests requiring Docker. **Current implementation** uses a pragmatic approach:

### What We Actually Do ✅
- **Unit tests (94%)**: Pure functions, no Docker required
  - Configuration generation, validation, string building
  - Tests run in ~10s, no external dependencies
- **Contract tests (6%)**: File operations only (`light init`)
  - No Docker, no mkcert, no external services
- **E2E tests (0%)**: Not implemented
  - Docker-dependent tests were removed (not our responsibility to test Docker)
  - Manual testing recommended for Docker workflows

### Why This Change?
**Problem**: Testing Docker is not our responsibility. We're an orchestration tool.
**Solution**: Test that we **build correct commands**, not that Docker works.

### For New Features
- Add **unit tests** for logic (YAML generation, command building)
- Add **contract tests** only for file operations (no Docker)
- **Don't add** tests requiring Docker - manual testing instead

See [CLAUDE.md Testing Strategy](../../CLAUDE.md#testing-strategy) for detailed guidelines.

---

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 3.1: Setup
- [x] T001 Create project structure with src/, tests/, and templates/ directories
- [x] T002 Initialize TypeScript project with package.json including bin field for 'light' command
- [x] T003 Install core dependencies (commander, cosmiconfig, chalk, ora, execa, update-notifier, js-yaml)
- [x] T004 [P] Configure ESLint and Prettier for TypeScript
- [x] T005 [P] Configure Vitest testing framework in vitest.config.ts
- [x] T006 [P] Create .gitignore with Node.js, TypeScript, and IDE patterns
- [x] T007 Configure package.json bin field pointing to dist/cli.js and test with npm link
- [x] T008 Set up TypeScript build configuration for CLI binary with shebang preservation

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Command Contract Tests
- [ ] T009 [P] Contract test for 'light init' command in tests/contract/test_init_command.ts
- [ ] T010 [P] Contract test for 'light up' command in tests/contract/test_up_command.ts
- [ ] T011 [P] Contract test for 'light deploy' command in tests/contract/test_deploy_command.ts
- [ ] T012 [P] Contract test for 'light status' command in tests/contract/test_status_command.ts
- [ ] T013 [P] Contract test for 'light logs' command in tests/contract/test_logs_command.ts
- [ ] T014 [P] Contract test for 'light down' command in tests/contract/test_down_command.ts

### Integration Tests (from quickstart scenarios)
- [ ] T015 [P] Integration test for project initialization workflow in tests/integration/test_project_init.ts
- [ ] T016 [P] Integration test for development environment startup in tests/integration/test_dev_startup.ts
- [ ] T017 [P] Integration test for Docker Compose file generation in tests/integration/test_compose_generation.ts
- [ ] T018 [P] Integration test for mkcert SSL certificate setup in tests/integration/test_ssl_setup.ts
- [ ] T019 [P] Integration test for configuration loading with cosmiconfig in tests/integration/test_config_loading.ts

### Error Recovery Tests
- [ ] T020 [P] Test error handling when Docker daemon is not running in tests/integration/test_docker_errors.ts
- [ ] T021 [P] Test port conflict detection and suggestions in tests/integration/test_port_conflicts.ts
- [ ] T022 [P] Test invalid configuration error messages in tests/integration/test_config_errors.ts
- [ ] T023 [P] Test unknown command suggestions in tests/integration/test_unknown_commands.ts
- [ ] T024 [P] Test network failure recovery in deployment in tests/integration/test_network_errors.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [x] T025 [P] Project entity model in src/models/project.ts (implemented inline in commands)
- [ ] T026 [P] Service entity model in src/models/service.ts
- [ ] T027 [P] DeploymentTarget entity model in src/models/deployment-target.ts
- [ ] T028 [P] Environment entity model in src/models/environment.ts

### Configuration and Schema
- [x] T029 [P] Configuration schema definition in src/schemas/config.schema.ts (YAML configuration implemented)
- [ ] T030 [P] Configuration loader using cosmiconfig in src/config/loader.ts
- [ ] T031 [P] Configuration validator with JSON Schema in src/config/validator.ts

### Docker Compose Templates
- [x] T032 Base Docker Compose template with Traefik service and network in templates/docker-compose/base.yml
- [x] T033 Dev override template with mkcert volumes and hot-reload configs in templates/docker-compose/dev.yml
- [x] T034 Prod override template with Let's Encrypt and replica configs in templates/docker-compose/prod.yml
- [x] T035 Traefik static configuration with providers and entrypoints in templates/traefik/traefik.yml

### Docker Compose Generator Components
- [x] T036 Service definition mapper (config to compose services) in src/services/compose/service-mapper.ts (implemented inline in init command)
- [x] T037 Port allocator for avoiding conflicts in src/services/compose/port-allocator.ts (implemented inline in init command)
- [x] T038 Traefik label generator for routing rules in src/services/compose/traefik-labels.ts (implemented inline in init command)
- [x] T039 Environment variable injector in src/services/compose/env-injector.ts (implemented inline in init command)
- [x] T040 Main compose file generator orchestrator in src/services/compose-generator.ts (implemented inline in init command)

### CLI Commands Implementation
- [x] T041 Main CLI entry point with Commander.js and shebang in src/cli.ts
- [x] T042 'light init' command implementation in src/commands/init.ts (with YAML config and BaaS detection)
- [x] T043 'light up' command implementation in src/commands/up.ts (with self-hosted Supabase stack generation)
- [ ] T044 'light deploy' command implementation in src/commands/deploy.ts
- [x] T045 'light status' command implementation in src/commands/status.ts
- [x] T046 'light logs' command implementation in src/commands/logs.ts
- [x] T047 'light down' command implementation in src/commands/down.ts
- [x] T048 'light env' command implementation in src/commands/env.ts (add/remove/list deployment targets)

### Core Services
- [x] T049 Docker service for shell commands in src/services/docker.ts (implemented inline in commands)
- [x] T050 mkcert service for SSL certificates in src/services/mkcert.ts (implemented inline in init command)
- [x] T051 Environment service for .env files in src/services/environment.ts (implemented inline in commands)
- [x] T052 Shell execution wrapper with execa in src/services/shell.ts (using child_process.execSync directly)
- [x] T053 Supabase stack generator in src/utils/supabase-stack.ts (complete self-hosted BaaS deployment)

## Phase 3.4: Integration

### Error Handling
- [x] T054 Custom error classes in src/errors/index.ts (implemented inline with proper error messages)
- [x] T055 Error formatting with chalk in src/utils/error-formatter.ts (implemented inline in commands)
- [x] T056 Global error handler for CLI in src/cli.ts
- [x] T057 Smart container health checking with recovery guidance in src/commands/up.ts

### User Experience
- [x] T058 Progress indicators with ora in src/utils/spinner.ts (implemented inline in commands)
- [x] T059 Colored output formatter with chalk in src/utils/output.ts (implemented inline in commands)
- [x] T060 Update notifier integration in src/cli.ts
- [x] T061 Help text and command aliases in src/cli.ts

### Prerequisites Validation
- [x] T062 Docker daemon check in src/validators/docker.ts (implemented inline in up command)
- [x] T063 Project validation (light.config.yml exists) in src/validators/project.ts (implemented inline in commands)
- [x] T064 Port availability checker in src/validators/ports.ts (implemented inline in init command)
- [x] T065 Supabase CLI and project validation for production deployments in src/commands/up.ts
- [x] T066 Automatic database migrations via Supabase CLI in src/commands/up.ts

## Phase 3.5: Polish

### Unit Tests
- [ ] T067 [P] Unit tests for configuration validator in tests/unit/test_config_validator.ts
- [ ] T068 [P] Unit tests for Docker Compose generator in tests/unit/test_compose_generator.ts
- [ ] T069 [P] Unit tests for error formatters in tests/unit/test_error_formatter.ts
- [ ] T070 [P] Unit tests for shell wrapper in tests/unit/test_shell.ts
- [ ] T071 [P] Unit tests for Supabase stack generator in tests/unit/test_supabase_stack.ts

### Documentation and Build
- [x] T072 Create package build script with TypeScript compiler
- [x] T073 Add npm publish configuration to package.json
- [ ] T074 [P] Generate API documentation with TypeDoc
- [x] T075 [P] Create CHANGELOG.md with initial version

### Documentation Site (https://cli.lightstack.dev)
- [ ] T076 Set up VitePress documentation site in docs/ directory
- [ ] T077 Create documentation structure (guides, API reference, examples)
- [ ] T078 Configure VitePress theme with Lightstack branding
- [ ] T079 Extract CLI command docs from Commander help text to docs/commands/
- [ ] T080 Convert quickstart.md to interactive getting-started guide
- [ ] T081 Create GitHub Actions workflow for docs deployment in .github/workflows/docs.yml
- [ ] T082 Configure Vercel/Netlify deployment for cli.lightstack.dev domain
- [ ] T083 Set up DNS records pointing cli.lightstack.dev to hosting

### End-to-End Validation
- [ ] T084 Run complete quickstart.md workflow manually
- [ ] T085 Verify all CLI commands match contract specifications
- [ ] T086 Test cross-platform compatibility (Windows/Mac/Linux)
- [ ] T087 Verify documentation site builds and deploys correctly
- [x] T088 Test self-hosted Supabase deployment locally (light up production)

## Dependencies
- Setup (T001-T008) must complete first
- Tests (T009-T024) before ANY implementation (T025-T051)
- Models (T025-T028) can run parallel, no dependencies
- Configuration (T029-T031) before compose generation (T036-T040)
- Templates (T032-T035) before compose generator (T040)
- Compose components (T036-T039) before main generator (T040)
- CLI entry (T041) before commands (T042-T047)
- Services (T048-T051) before command implementations
- All core implementation before integration (T052-T061)
- Integration before polish (T062-T069)
- Documentation site (T070-T077) can start after T041 (CLI exists)
- DNS setup (T077) independent, can be done anytime
- End-to-end validation (T078-T081) must be last

## Parallel Execution Examples

### Launch all contract tests together (T009-T014):
```
Task: "Contract test for 'light init' command in tests/contract/test_init_command.ts"
Task: "Contract test for 'light up' command in tests/contract/test_up_command.ts"
Task: "Contract test for 'light deploy' command in tests/contract/test_deploy_command.ts"
Task: "Contract test for 'light status' command in tests/contract/test_status_command.ts"
Task: "Contract test for 'light logs' command in tests/contract/test_logs_command.ts"
Task: "Contract test for 'light down' command in tests/contract/test_down_command.ts"
```

### Launch all model tasks together (T025-T028):
```
Task: "Project entity model in src/models/project.ts"
Task: "Service entity model in src/models/service.ts"
Task: "DeploymentTarget entity model in src/models/deployment-target.ts"
Task: "Environment entity model in src/models/environment.ts"
```

### Launch all integration tests together (T015-T019):
```
Task: "Integration test for project initialization workflow in tests/integration/test_project_init.ts"
Task: "Integration test for development environment startup in tests/integration/test_dev_startup.ts"
Task: "Integration test for Docker Compose file generation in tests/integration/test_compose_generation.ts"
Task: "Integration test for mkcert SSL certificate setup in tests/integration/test_ssl_setup.ts"
Task: "Integration test for configuration loading with cosmiconfig in tests/integration/test_config_loading.ts"
```

### Launch all error recovery tests together (T020-T024):
```
Task: "Test error handling when Docker daemon is not running in tests/integration/test_docker_errors.ts"
Task: "Test port conflict detection and suggestions in tests/integration/test_port_conflicts.ts"
Task: "Test invalid configuration error messages in tests/integration/test_config_errors.ts"
Task: "Test unknown command suggestions in tests/integration/test_unknown_commands.ts"
Task: "Test network failure recovery in deployment in tests/integration/test_network_errors.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task or task group
- Follow TDD strictly: tests MUST fail before implementation
- Use existing tools (Docker Compose, Traefik, mkcert) rather than reimplementing

## Implementation Notes (Completed Work)
### Key Architectural Decisions Made:
- **Configuration Format**: Switched from JSON to YAML for better readability and comments
- **Environment Variables**: Single .env file approach (12-factor principles) - CLI doesn't generate .env files
- **Supabase Integration**: Detection via supabase/ directory, complete self-hosted stack deployment
- **Service Architecture**: Implemented inline in commands rather than separate service classes (YAGNI principle)
- **Proxy Domain**: Using proxy.lvh.me (product-agnostic) instead of traefik.lvh.me
- **Template Approach**: Removed --template option, focused on Nuxt-only implementation
- **Package Manager**: Using Bun for development (10-100x faster than npm)
- **BaaS Platform**: Supabase-only for now (other platforms may be added later if needed - YAGNI)

## Validation Checklist
*GATE: Checked before execution*

- [x] All CLI commands have corresponding contract tests (T009-T014)
- [x] All entities have model tasks (T025-T028)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Quickstart scenarios covered by integration tests (T015-T019)
- [x] Error recovery covered by tests (T020-T024)
- [x] Binary configuration included (T007-T008)
- [x] Docker Compose generation properly decomposed (T036-T040)
- [x] Templates have specific implementation details (T032-T035)
- [x] Documentation site deployment included (T070-T077)
- [x] NFR-001 satisfied: docs at https://cli.lightstack.dev
- [x] All services defined in plan have implementation tasks

---

## Phase 4: Production Stack Refactoring (Current Priority)

### P0: Critical Fixes - Supabase Stack Architecture Change

**CONTEXT**: Container restart loops discovered during testing. Root cause: We were hand-crafting Supabase docker-compose instead of using official Supabase stack. Decision: Switch to bundling and using official Supabase docker files.

**Architecture Change**:
- ❌ OLD: Hand-craft `generateSupabaseStack()` → custom Docker Compose YAML
- ✅ NEW: Bundle official Supabase docker files → copy and customize

**Benefits**:
- Always compatible with official Supabase
- All init scripts and schemas automatically included
- Bug fixes from Supabase team flow through
- Much simpler codebase

### Supabase Stack Tasks (Blocking Production Testing)

- [ ] T089 **[CRITICAL]** Refactor production stack generation to use official Supabase files
  - Copy `templates/supabase/docker-compose.yml` → `.light/supabase/docker-compose.yml`
  - Copy `templates/supabase/volumes/` → `.light/supabase/volumes/`
  - Create `.light/supabase/.env` mapping our variables to Supabase format
  - Update docker compose command to use official stack
  - **Files**: `src/commands/up.ts`, `src/utils/supabase-stack.ts`

- [ ] T090 Update environment variable mapping for Supabase compatibility
  - Map `PRODUCTION_POSTGRES_PASSWORD` → `POSTGRES_PASSWORD`
  - Map `PRODUCTION_JWT_SECRET` → `JWT_SECRET`
  - Map `PRODUCTION_ANON_KEY` → `ANON_KEY`
  - Map `PRODUCTION_SERVICE_KEY` → `SERVICE_ROLE_KEY`
  - **File**: `src/commands/up.ts` (generateProductionStack function)

- [ ] T091 Remove custom Supabase stack generation code
  - Delete or simplify `generateSupabaseStack()` in `src/utils/supabase-stack.ts`
  - Keep only secrets generation functions
  - Update tests to match new architecture
  - **File**: `src/utils/supabase-stack.ts`

- [ ] T092 Test complete production stack with official Supabase files
  - Run `light up production` with real Supabase project
  - Verify all 9 containers start successfully (no restart loops)
  - Verify database migrations apply correctly
  - Verify Studio, API, and Auth are accessible
  - **Testing**: Manual verification in playground repo

### P0: Domain Configuration Fixes

- [ ] T093 Use provided domain instead of hardcoded local.lightstack.dev
  - Read domain from deployment config (`app.yourdomain.com`)
  - Default to `local.lightstack.dev` only if no domain provided
  - **File**: `src/commands/up.ts` (line 476)

- [ ] T094 Add subdomain prompts to `light env add` command
  - Prompt for app domain (main domain)
  - Prompt for API subdomain (default: `api.{app-domain}`)
  - Prompt for Studio subdomain (default: `studio.{app-domain}`)
  - Store all three in deployment config
  - **File**: `src/commands/env.ts`

- [ ] T095 Disable Traefik dashboard in production mode
  - Only expose dashboard in development environment
  - Remove dashboard route from production Traefik config
  - **File**: `src/commands/up.ts` (generateProductionTraefikConfig function)

### P1: High Priority UX Improvements

- [ ] T096 Move ACME email prompt from init to env add command
  - Remove ACME email prompt from `light init`
  - Add ACME email prompt to `light env add` (when SSL enabled)
  - Update user config management accordingly
  - **Files**: `src/commands/init.ts`, `src/commands/env.ts`

- [ ] T097 Add confirmation prompt to reuse existing ACME email
  - Check for existing ACME email in user config
  - Prompt: "Use existing email (x@y.com) or provide new one?"
  - Allow updating email if user chooses
  - **File**: `src/commands/env.ts`

- [ ] T098 Move Dockerfile to .light/ directory
  - Generate Dockerfile at `.light/Dockerfile` instead of root
  - Update .gitignore to exclude `.light/Dockerfile`
  - **File**: `src/commands/init.ts`

- [ ] T099 Handle missing SMTP environment variables gracefully
  - Suppress Docker Compose warnings for optional SMTP vars
  - Add default values for SMTP_USER and SMTP_PASS
  - **File**: `src/utils/supabase-stack.ts` or env mapping

### P2: Medium Priority Polish

- [ ] T100 Simplify init command output
  - Remove file generation details ("Docker Compose files generated", etc.)
  - Keep only essential confirmation messages
  - **File**: `src/commands/init.ts`

- [ ] T101 Update init next steps to emphasize dev/prod parity value
  - Highlight complete Supabase stack deployment
  - Show local production testing capability
  - Remove generic "other BaaS services" messaging
  - **File**: `src/commands/init.ts`

- [ ] T102 Standardize command highlighting (cyan color)
  - Use consistent `chalk.cyan()` for all command examples
  - Apply to: init output, up output, env output
  - Apply to migration command suggestion
  - **Files**: `src/commands/init.ts`, `src/commands/up.ts`, `src/commands/env.ts`

- [ ] T103 Align domain list between init and up command outputs
  - Show same domains in both commands
  - Consistent formatting and order
  - **Files**: `src/commands/init.ts`, `src/commands/up.ts`

- [ ] T104 Group SSL certificate output in up command
  - Move certificate output away from Supabase detection
  - Group all SSL setup together
  - **File**: `src/commands/up.ts`

- [ ] T105 Clarify or remove "Supabase instance detected" message
  - Consider removing if not adding value at that point
  - Or make it actionable with next steps
  - **File**: `src/commands/up.ts`

- [ ] T106 Remove verbose/quiet flags or implement them
  - Currently defined but not implemented
  - Decision: Remove for now (YAGNI)
  - **File**: `src/cli.ts`

- [ ] T107 Update up command description to emphasize local infrastructure
  - Remove "production" from description
  - Emphasize local aspect and environment flexibility
  - **File**: `src/cli.ts`

- [ ] T108 Fix "Error: (outputHelp)" when running light with no args
  - Handle no arguments gracefully
  - Show help without error message
  - **File**: `src/cli.ts`

### P3: Low Priority Nice-to-Have

- [ ] T109 Remove noise from Supabase stack generation output
  - Remove "Generating self-hosted Supabase stack..." message
  - Keep only essential status updates
  - **File**: `src/commands/up.ts`

## Implementation Notes (Phase 4)

### Official Supabase Stack Integration
**Date**: 2025-10-02
**Status**: ✅ Files bundled, ⏳ Integration pending
**Location**: `templates/supabase/`
**Version**: Commit 75962742048c (2025-10-02)

**What's Bundled**:
- `docker-compose.yml` - Complete official Supabase stack
- `volumes/db/*.sql` - Database initialization scripts (roles, JWT, webhooks, etc.)
- `volumes/api/kong.yml` - Kong API Gateway configuration
- `.env.example` - Official environment variable template

**Integration Strategy**:
1. Copy official files from `templates/supabase/` to `.light/supabase/`
2. Create env mapping: `PRODUCTION_*` → Supabase expected format
3. Use `docker compose -f .light/supabase/docker-compose.yml --env-file .light/supabase/.env up`
4. No custom YAML generation - leverage official stack entirely