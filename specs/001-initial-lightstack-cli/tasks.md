# Tasks: Lightstack CLI Core Foundation

**Input**: Design documents from `/specs/001-initial-lightstack-cli/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

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
- [x] T043 'light up' command implementation in src/commands/up.ts (with BaaS proxy generation)
- [ ] T044 'light deploy' command implementation in src/commands/deploy.ts
- [ ] T045 'light status' command implementation in src/commands/status.ts
- [ ] T046 'light logs' command implementation in src/commands/logs.ts
- [x] T047 'light down' command implementation in src/commands/down.ts

### Core Services
- [x] T048 Docker service for shell commands in src/services/docker.ts (implemented inline in commands)
- [x] T049 mkcert service for SSL certificates in src/services/mkcert.ts (implemented inline in init command)
- [x] T050 Environment service for .env files in src/services/environment.ts (implemented inline in commands)
- [x] T051 Shell execution wrapper with execa in src/services/shell.ts (using child_process.execSync directly)

## Phase 3.4: Integration

### Error Handling
- [x] T052 Custom error classes in src/errors/index.ts (implemented inline with proper error messages)
- [x] T053 Error formatting with chalk in src/utils/error-formatter.ts (implemented inline in commands)
- [x] T054 Global error handler for CLI in src/cli.ts

### User Experience
- [x] T055 Progress indicators with ora in src/utils/spinner.ts (implemented inline in commands)
- [x] T056 Colored output formatter with chalk in src/utils/output.ts (implemented inline in commands)
- [x] T057 Update notifier integration in src/cli.ts
- [x] T058 Help text and command aliases in src/cli.ts

### Prerequisites Validation
- [x] T059 Docker daemon check in src/validators/docker.ts (implemented inline in up command)
- [x] T060 Project validation (light.config.yml exists) in src/validators/project.ts (implemented inline in commands)
- [x] T061 Port availability checker in src/validators/ports.ts (implemented inline in init command)

## Phase 3.5: Polish

### Unit Tests
- [ ] T062 [P] Unit tests for configuration validator in tests/unit/test_config_validator.ts
- [ ] T063 [P] Unit tests for Docker Compose generator in tests/unit/test_compose_generator.ts
- [ ] T064 [P] Unit tests for error formatters in tests/unit/test_error_formatter.ts
- [ ] T065 [P] Unit tests for shell wrapper in tests/unit/test_shell.ts

### Documentation and Build
- [ ] T066 Create package build script with TypeScript compiler
- [ ] T067 Add npm publish configuration to package.json
- [ ] T068 [P] Generate API documentation with TypeDoc
- [ ] T069 [P] Create CHANGELOG.md with initial version

### Documentation Site (https://cli.lightstack.dev)
- [ ] T070 Set up VitePress documentation site in docs/ directory
- [ ] T071 Create documentation structure (guides, API reference, examples)
- [ ] T072 Configure VitePress theme with Lightstack branding
- [ ] T073 Extract CLI command docs from Commander help text to docs/commands/
- [ ] T074 Convert quickstart.md to interactive getting-started guide
- [ ] T075 Create GitHub Actions workflow for docs deployment in .github/workflows/docs.yml
- [ ] T076 Configure Vercel/Netlify deployment for cli.lightstack.dev domain
- [ ] T077 Set up DNS records pointing cli.lightstack.dev to hosting

### End-to-End Validation
- [ ] T078 Run complete quickstart.md workflow manually
- [ ] T079 Verify all CLI commands match contract specifications
- [ ] T080 Test cross-platform compatibility (Windows/Mac/Linux)
- [ ] T081 Verify documentation site builds and deploys correctly

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
- **BaaS Integration**: Detection and proxy generation moved from init to up command for just-in-time configuration
- **Service Architecture**: Implemented inline in commands rather than separate service classes (YAGNI principle)
- **Proxy Domain**: Using proxy.lvh.me (product-agnostic) instead of traefik.lvh.me
- **Template Approach**: Removed --template option, focused on Nuxt-only implementation
- **Package Manager**: Using Bun for development (10-100x faster than npm)

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