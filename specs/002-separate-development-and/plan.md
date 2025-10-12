# Implementation Plan: Separate Development and Deployment Workflows

**Branch**: `002-separate-development-and` | **Date**: 2025-10-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-separate-development-and/spec.md`

## Summary

This feature separates the currently-mingled development and deployment workflows into clear, distinct code paths. Development mode (`light up`) will start only a Traefik proxy that routes to localhost services (Supabase CLI + user's dev server) for fast iteration. Deployment mode (`light up <environment>`) will start a full containerized stack (Supabase services + user's app container) with mkcert SSL by default for fast local testing; optionally use `--ca letsencrypt` flag for full DNS/certificate validation before remote deployment. This addresses GitHub issue #17 by refactoring `up.ts` into `deployDevMode()` and `deployFullStackMode()` functions, adding environment conflict detection (one environment at a time, auto-switch with [Y/n] prompt), renaming `docker-compose.production.yml` to `docker-compose.deployment.yml` for clarity, and providing mode-appropriate user guidance.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: Commander.js (CLI framework), Docker Compose (external), Traefik (external), mkcert (external), Supabase CLI (external), Docker Init (recommended for Dockerfile creation)
**Storage**: File system for generated Docker Compose files and Traefik configs
**Testing**: Vitest (unit tests for logic, contract tests for file generation only)
**Target Platform**: Cross-platform CLI (Windows, macOS, Linux) with Docker Desktop
**Project Type**: Single CLI project
**Performance Goals**: Development mode startup <5s (proxy only), Deployment mode startup <60s (includes builds)
**Constraints**: Must work with existing Spec 001 architecture, preserve backward compatibility for user projects initialized with Spec 001
**Scale/Scope**: Refactor 1 command file (`up.ts`), update file generators (compose file generators for app service, **remove Dockerfile generation**), add mode detection logic

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Don't Reinvent the Wheel ✅ PASS
- Uses existing Docker Compose for containerization
- Uses existing Traefik for reverse proxy
- Uses existing mkcert for development SSL
- Uses existing Supabase CLI for migrations
- **Uses `docker init` for Dockerfile creation** (removed custom generation - violated this principle)
- Orchestrates these tools, doesn't reimplement them

### Principle II: Configuration Over Code ✅ PASS
- Generates `docker-compose.deployment.yml` (renamed from production.yml)
- Generates Traefik dynamic configs
- **Validates** user-provided Dockerfile (doesn't generate - users use `docker init`)
- All generated files are readable and version-controllable

### Principle III: Single Responsibility ✅ PASS
- `deployDevMode()`: proxy orchestration only
- `deployFullStackMode()`: full stack orchestration only
- Clear separation of concerns, no function trying to do both

### Principle IV: Fail Fast, Fail Clearly ✅ PASS
- Detect port conflicts before starting containers
- Validate Dockerfile exists before attempting build in deployment mode
- Provide actionable error messages with solutions

### Principle V: Progressive Disclosure ✅ PASS
- Default `light up` uses simple development mode
- Deployment mode requires explicit environment parameter
- Smart defaults (proxy to port 3000, use lvh.me domain)

### Principle IX: Spec-Driven Development ✅ PASS
- This plan follows spec.md created from GitHub issue #17
- Spec documents current architecture decisions
- Implementation will match spec requirements

### Principle XII: Test-Driven Development ✅ PASS
- Will write tests for mode detection logic
- **Will write tests for Dockerfile validation** (removed generation tests)
- Will write tests for compose file generation with app service
- Tests focus on logic, not Docker execution (Principle XIII)

### Principle XIII: Test What We Own ✅ PASS
- Test: "Does `determineMode(env)` return correct mode?"
- **Test: "Does validation detect missing Dockerfile correctly?"** (removed generation tests)
- Test: "Does compose generator include app service in deployment.yml?"
- NOT testing: "Does Docker actually build the image?" (that's Docker's job)

**GATE STATUS**: ✅ ALL CHECKS PASS - Proceed to Phase 0

## Constitution Exception: Spec Size

**Principle**: IX. Spec-Driven Development states "Small specs (10-15 tasks) ship faster than large specs (100+ tasks)"

**Violation**: This spec contains 39 tasks (260% of guideline)

**Justification**:
- This is a tightly-coupled refactoring of a single command file (`up.ts`)
- Splitting would create incomplete, untestable intermediate states
- User stories are independent, but share foundational infrastructure (Phase 2)
- MVP delivery still achievable in 15 tasks (Setup + Foundational + US1)
- All 4 user stories fit within "days to ship" timeline (not weeks/months)

**Mitigation**:
- Clear phase boundaries enable incremental delivery and validation
- MVP checkpoint after T015 (development mode only)
- Independent user story testing prevents big-bang integration
- Parallel execution opportunities reduce calendar time (12 tasks can run concurrently)

**Approval**: Documented exception for Spec 002. Future refactorings should still target 10-15 tasks.

## Project Structure

### Documentation (this feature)

```
specs/002-separate-development-and/
├── plan.md              # This file
├── research.md          # Phase 0: Dockerfile patterns, refactoring strategies
├── data-model.md        # Phase 1: Mode enumeration, DeploymentConfig schema
├── quickstart.md        # Phase 1: Developer guide for testing both modes
├── contracts/           # Phase 1: Function signatures for refactored code
│   └── up-command.md    # deployDevMode(), deployFullStackMode() signatures
└── tasks.md             # Phase 2: Generated by /speckit.tasks (not this command)
```

### Source Code (repository root)

```
src/
├── commands/
│   ├── up.ts            # REFACTOR: Split into deployDevMode() / deployFullStackMode()
│   └── init.ts          # UPDATE: Show Dockerfile guidance message if missing
├── utils/
│   ├── config.ts        # EXISTING: Project config loading
│   ├── docker.ts        # NEW: Docker command builders, mode detection
│   └── compose-generator.ts  # UPDATE: Add app service to deployment.yml

tests/
├── unit/
│   ├── docker.test.ts   # NEW: Test mode detection, command building
│   └── compose-generator.test.ts  # UPDATE: Test app service inclusion
└── contract/
    └── file-generation.test.ts  # UPDATE: Test actual file output

.light/                  # Generated (in user projects)
├── docker-compose.yml   # EXISTING: Base Traefik config
├── docker-compose.development.yml  # EXISTING: Proxy to localhost
└── docker-compose.deployment.yml   # RENAMED from production.yml, UPDATE: Add app service
```

**Structure Decision**: Single CLI project. This is a refactoring task, not a new project. The existing `src/commands/up.ts` will be split into two execution paths with shared utilities extracted to `src/utils/docker.ts`. **Dockerfile generation utilities (`src/utils/dockerfile.ts`, `src/templates/Dockerfile`) have been REMOVED** - users create Dockerfiles via `docker init` or manually. The compose file generator will be updated to include the app service definition in the deployment override file.

## Complexity Tracking

*No violations* - this feature follows all constitutional principles without exceptions.

## Post-Implementation Changes (2025-10-12)

**Dockerfile Generation Removal**:
- **Decision**: Removed custom Dockerfile generation (violated Constitutional Principle I: "Don't Reinvent the Wheel")
- **Rationale**: Dockerfile generation is a complex problem already solved by battle-tested tools (`docker init`, Nixpacks, Paketo Buildpacks). Supporting all frameworks, package managers, and workspace configurations creates maintenance burden without matching specialized tools.
- **New Approach**: CLI validates Dockerfile exists and provides helpful error messages pointing users to `docker init` (recommended) or manual creation
- **Removed Code**:
  - `src/utils/dockerfile.ts` - Dockerfile template generation
  - `src/templates/Dockerfile` - Node.js Dockerfile template
  - `src/commands/generate/dockerfile.ts` - `light generate dockerfile` command
  - `src/commands/generate.ts` - Generate command group
- **Updated Code**:
  - `src/commands/init.ts` - Now shows informative message if Dockerfile missing (doesn't generate)
  - `src/commands/up.ts` - Deployment validation suggests `docker init` instead of generation
- **Related**: Closed GitHub Issue #19 as wont-fix (auto-generation would still violate Principle I)

