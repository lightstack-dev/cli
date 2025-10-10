---
description: "Task list for Separate Development and Deployment Workflows"
---

# Tasks: Separate Development and Deployment Workflows

**Input**: Design documents from `/specs/002-separate-development-and/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Manual testing per quickstart.md for Docker integration (SC-008); automated unit + contract tests per SC-009/SC-010

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths shown below follow existing Lightstack CLI structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for refactoring

- [X] T001 Create new utility files: `src/utils/docker.ts` for mode detection and Docker command builders
- [X] T002 [P] Create new utility file: `src/utils/dockerfile.ts` for Dockerfile template generation
- [X] T003 [P] Create template directory and Dockerfile template: `src/templates/Dockerfile` with multi-stage Node.js pattern from research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core mode detection and refactoring infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement `determineMode(env: string): Mode` function in `src/utils/docker.ts` (returns 'development' | 'deployment')
- [X] T005 Implement `getComposeFiles(env: string): string[]` function in `src/utils/docker.ts` (returns correct compose file list based on mode)
- [X] T006 [P] Implement `buildDockerCommand()` utility in `src/utils/docker.ts` for constructing docker compose commands
- [X] T007 [P] Implement `generateDockerfile(config: DockerfileConfig): string` in `src/utils/dockerfile.ts` using multi-stage pattern
- [X] T008 Refactor `upCommand()` in `src/commands/up.ts` to add early mode detection and branching logic (lines 48-50)
- [X] T009 Extract `commonPrerequisiteChecks(env: string)` from current `upCommand()` in `src/commands/up.ts` (checks Docker, config, environment exists)
- [X] T009a Add `--ca <provider>` flag to up command schema in `src/commands/up.ts` using Commander.js `.option()` with choices validation ['mkcert', 'letsencrypt']
- [X] T009b Implement `validateSSLProvider(provider: string): SSLProvider` utility in `src/utils/docker.ts` to validate and return typed SSL provider enum

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Local Development with Proxy Mode (Priority: P1) 🎯 MVP

**Goal**: Refactor development mode into dedicated `deployDevMode()` function with clear separation from deployment logic

**Independent Test**: Run `light up`, verify only Traefik starts, proxy routes work to localhost, output shows "Start your app: npm run dev"

### Implementation for User Story 1

- [X] T010 [US1] Extract development mode logic (lines 94-168 from current `up.ts`) into new `deployDevMode(options: UpOptions)` function in `src/commands/up.ts`
- [X] T011 [US1] Update `deployDevMode()` to call `setupMkcert()` for SSL certificate generation
- [X] T012 [US1] Update `deployDevMode()` to call `generateBaaSProxyConfigs()` for Traefik dynamic.yml generation (file-based routing)
- [X] T013 [US1] Update `deployDevMode()` to use `getComposeFiles('development')` and `buildDockerCommand()` from utils
- [X] T014 [US1] Update `showRouterStatus()` in `src/commands/up.ts` to show "Start your app: <detected-package-manager> run dev" message ONLY when env === 'development'
- [X] T015 [US1] Update `upCommand()` to call `deployDevMode(options)` when mode === 'development'

**Checkpoint**: At this point, `light up` should work identically to before but with cleaner code separation

---

## Phase 4: User Story 2 - Local Deployment Testing with Full Stack (Priority: P2)

**Goal**: Refactor deployment mode into dedicated `deployFullStackMode()` function with Supabase stack orchestration, environment conflict detection, and SSL provider support

**Independent Test**: Run `light up staging`, verify full Supabase stack starts in containers, environment conflict detection works, SSL provider defaults to mkcert with info message, migrations run

### Implementation for User Story 2

- [ ] T016 [US2] Extract deployment mode logic (lines 99-260 from current `up.ts`) into new `deployFullStackMode(env: string, options: UpOptions)` function in `src/commands/up.ts`
- [ ] T017 [US2] Add `detectRunningEnvironment()` utility in `src/utils/docker.ts` to detect running Lightstack environments by reading `.light/.current-env` file (contains environment name) and verifying Traefik container is running; returns current environment name or null
- [ ] T017a [US2] Add `checkSupabaseDevEnvironment()` utility in `src/utils/docker.ts` to detect if Supabase CLI is running by checking localhost ports 54321 (Kong API), 54323 (Auth), 54324 (Studio); returns boolean
- [ ] T017b [US2] Implement `checkPortConflicts()` utility in `src/utils/docker.ts` to detect if ports 80 and 443 are occupied by any process (use platform-specific commands: `netstat` on Windows, `lsof` on Unix); return occupying process info or null
- [ ] T018 [US2] Update `deployFullStackMode()` to check for running environments at start using T017 and T017b: first check if another Lightstack environment is running (T017); if same env detected, show `light status` output and exit gracefully; if different env detected, use inquirer prompt "Stop '<current>' and start '<requested>'? [Y/n]" with 10-second timeout defaulting to YES, then stop current environment before proceeding; if no Lightstack environment but ports 80/443 occupied (T017b), show error: "Ports 80/443 are occupied by <process>. Stop it first: <suggested command>"
- [ ] T019 [US2] Update `deployFullStackMode()` to call `checkSupabaseDevEnvironment()` (from T017a) and prompt user to stop if conflicts detected
- [ ] T020 [US2] Add SSL provider determination logic in `deployFullStackMode()`: read `options.ca` (from T009a flag parsing), default to 'mkcert', pass to generateProductionStack()
- [ ] T021 [US2] Update `deployFullStackMode()` to call `generateProductionStack()` for Supabase stack configuration with SSL provider parameter
- [ ] T022 [US2] Update `deployFullStackMode()` to use `getComposeFiles(env)` which returns deployment.yml (not production.yml)
- [ ] T023 [US2] Update `deployFullStackMode()` to call `runSupabaseMigrations()` with containerized PostgreSQL connection (supabase-db:5432) after containers start; validate migration success by checking exit code; on failure, show migration errors and suggest: "Check migration files in supabase/migrations/ or run: light logs supabase-db"
- [ ] T024 [US2] Update `upCommand()` to call `deployFullStackMode(env, options)` when mode === 'deployment'

**Checkpoint**: At this point, `light up staging` should start full Supabase stack with mkcert SSL, detect environment conflicts, and show SSL info message (but app still needs to be containerized in US3)

---

## Phase 5: User Story 3 - App Containerization for Deployment Testing (Priority: P2)

**Goal**: Add Dockerfile generation to `init` command and app service to deployment compose file for complete containerization

**Independent Test**: Run `light up staging`, verify app container builds and runs from Dockerfile, accessible via HTTPS

### Implementation for User Story 3

- [ ] T025 [P] [US3] Update `initCommand()` in `src/commands/init.ts` to call `generateDockerfile()` and write to project root `Dockerfile` if it doesn't exist
- [ ] T025a [P] [US3] Add validation in `generateDockerfile()` to check if package.json exists and has required `build` and `start` scripts; if missing, throw error with message: "Your package.json is missing required scripts. Add: \"scripts\": { \"build\": \"...\", \"start\": \"...\" }"
- [ ] T026 [P] [US3] Update compose file generator to generate `docker-compose.deployment.yml` (replacing the old `docker-compose.production.yml` pattern) throughout codebase
- [ ] T027 [US3] Add app service definition to `docker-compose.deployment.yml` template with Traefik labels (see research.md for YAML structure)
- [ ] T028 [US3] Update `generateProductionTraefikConfig()` in `src/commands/up.ts` to remove app proxy to localhost (app is now containerized)
- [ ] T029 [US3] Add Dockerfile validation check in `deployFullStackMode()` before attempting Docker Compose build
- [ ] T030 [US3] Update error handling in `deployFullStackMode()` to show build logs and troubleshooting when app container fails to build/start

**Checkpoint**: All deployment environments now run fully containerized stacks including the user's app

---

## Phase 6: User Story 4 - Clear User Guidance Based on Mode (Priority: P3)

**Goal**: Update CLI output to provide mode-appropriate guidance without confusing messages

**Independent Test**: Run `light up` and verify "Start your app" message, run `light up staging` and verify NO "Start your app" message

### Implementation for User Story 4

- [ ] T031 [US4] Update `showRouterStatus()` in `src/commands/up.ts` to remove "Start your app" message when env !== 'development' (already started in T014, complete here)
- [ ] T032 [US4] Add deployment-specific troubleshooting messages to error handlers in `deployFullStackMode()` (Dockerfile errors, build errors, container errors)
- [ ] T033 [US4] Update `showRouterStatus()` to show containerized app indicator in deployment mode (e.g., "Your application (containerized)")
- [ ] T034 [US4] Add SSL info message in `deployFullStackMode()` when using mkcert (default) with exact FR-010 wording: "ℹ Using mkcert certificates (fast local testing). To use Let's Encrypt: light up <env> --ca letsencrypt"

**Checkpoint**: User guidance is now contextually appropriate for each mode

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final cleanup

- [ ] T035 [P] Update `.gitignore` template generation in `src/commands/init.ts` to include `Dockerfile` in version control (NOT gitignored)
- [ ] T036 [P] Update compose file generation logic to generate `docker-compose.deployment.yml` instead of `docker-compose.production.yml` for all non-development environments; update ALL references throughout codebase (verify: src/commands/*.ts, src/utils/*.ts, tests/**, documentation files, error messages, and any hardcoded strings)
- [ ] T037 Add JSDoc comments to new functions in `src/utils/docker.ts` and `src/utils/dockerfile.ts`
- [ ] T038 [P] Update CLAUDE.md to reflect completed Spec 002 (remove "NOT YET IMPLEMENTED" note, update workflow examples)
- [ ] T039 Run quickstart.md test scenarios to validate both modes work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Can start after Foundational - No dependencies on other stories
  - US2 (P2): Can start after Foundational - Independent from US1 but typically done sequentially to build on refactoring
  - US3 (P2): Can start after Foundational - Adds to US2's work (app containerization)
  - US4 (P3): Depends on US1 completion (updates showRouterStatus from T014)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1 - MVP)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 2 (P2)**: Can start after Foundational - Works independently but builds on US1 refactoring patterns
- **User Story 3 (P2)**: Can start after Foundational - Adds app containerization to deployment mode
- **User Story 4 (P3)**: Depends on US1 (T014) completing showRouterStatus refactoring

### Within Each User Story

- Setup tasks (Phase 1) can all run in parallel [P]
- Foundational tasks T004-T007 can run in parallel [P] (different files)
- Foundational tasks T008-T009 must run sequentially (same file, refactoring steps)
- US1: T010-T015 are sequential refactoring steps in same file
- US2: T016-T024 are sequential refactoring steps in same file
- US3: T025-T027 can run in parallel [P] (different files/concerns)
- US3: T028-T030 are sequential (same file, dependent logic)
- US4: All tasks are small updates to existing functions
- Polish: T031-T032 can run in parallel [P], T034-T035 are final steps

### Parallel Opportunities

- **Phase 1 (Setup)**: All 3 tasks can run in parallel (T001, T002, T003)
- **Phase 2 (Foundational)**: T004-T007 can run in parallel (4 tasks)
- **Phase 5 (US3)**: T025-T027 can run in parallel (3 tasks)
- **Phase 7 (Polish)**: T035-T036 can run in parallel (2 tasks)

**Total Parallel Opportunities**: 12 tasks can potentially run concurrently if team capacity allows

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all foundational utility implementations together:
Task: "Implement determineMode() in src/utils/docker.ts"
Task: "Implement getComposeFiles() in src/utils/docker.ts"
Task: "Implement buildDockerCommand() in src/utils/docker.ts"
Task: "Implement generateDockerfile() in src/utils/dockerfile.ts"

# Then sequentially refactor upCommand:
Task: "Refactor upCommand() to add mode detection"
Task: "Extract commonPrerequisiteChecks()"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009) - CRITICAL
3. Complete Phase 3: User Story 1 (T010-T015)
4. **STOP and VALIDATE**: Test development mode independently per quickstart.md Scenario 1
5. Ensure `light up` works identically to before (backward compatible)
6. **SHIP MVP**: Development mode refactoring complete, cleaner code, ready for deployment mode work

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T009)
2. Add User Story 1 → Test independently → **Validate backward compatibility** (T010-T015)
3. Add User Story 2 → Test independently → **Supabase stack orchestration** (T016-T021)
4. Add User Story 3 → Test independently → **App containerization complete** (T022-T027)
5. Add User Story 4 → Test independently → **UX polish** (T028-T030)
6. Polish → Final validation → **Ship complete feature** (T031-T035)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T009)
2. Once Foundational is done:
   - **Sequential approach** (recommended for refactoring):
     - Developer A: US1 (T010-T015) → US2 (T016-T021)
     - Developer B: US3 (T022-T027) after US2 starts
     - Developer C: US4 (T028-T030) after US1 completes
   - **Parallel approach** (if team has deep context):
     - Developer A: US1 (T010-T015)
     - Developer B: US2 (T016-T021) + US3 (T022-T027)
     - Developer C: US4 (T028-T030) + Polish (T031-T035)
3. Stories integrate and validate independently
4. Final integration testing with all stories complete

---

## Testing Strategy

**Manual Testing**: Use `specs/002-separate-development-and/quickstart.md` test scenarios:

- **Scenario 1**: Development mode (proxy only) - after T015
- **Scenario 2**: Deployment mode (full stack) - after T021
- **Scenario 3**: Port conflict detection - after T018
- **Scenario 4**: Dockerfile validation - after T029
- **Scenario 5**: Mode-appropriate guidance - after T034

**Automated Testing**: Per constitution Principle XIII (Test What We Own):

- Unit test `determineMode()`: Returns correct mode for env inputs
- Unit test `getComposeFiles()`: Returns correct file list per mode
- Unit test `generateDockerfile()`: Outputs valid Dockerfile structure
- Contract test Dockerfile generation: Actual file created with expected content
- Contract test compose file generation: App service included in deployment.yml

**Manual Integration Testing** (not automated per testing philosophy):

- Full stack startup with Docker
- App container build and run
- Traefik routing to containerized services
- Database migrations execution

---

## Notes

- [P] tasks = different files/concerns, can run in parallel
- [Story] label (US1, US2, US3, US4) maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Stop at any checkpoint to validate story independently before proceeding
- Commit after each task or logical group (e.g., after each user story phase)
- **Estimated total time**: 39 tasks × 30-60 min/task = 20-40 hours for solo developer
- **MVP delivery time**: 9 tasks (Setup + Foundational + US1) = ~4-6 hours
- **Complete feature delivery**: All 39 tasks = ~20-40 hours

---

## Success Criteria by User Story

**User Story 1 (MVP)**:
- ✅ `light up` starts only Traefik container
- ✅ Proxy routes work to localhost services
- ✅ Output shows "Start your app: npm run dev"
- ✅ Hot-reload still works (app not containerized)
- ✅ Code is cleaner with dedicated deployDevMode() function

**User Story 2**:
- ✅ `light up staging` starts full Supabase stack (~10 containers)
- ✅ Environment conflict detection prompts user to switch (default YES)
- ✅ SSL provider defaults to mkcert with info message about --ca letsencrypt flag
- ✅ Database migrations run successfully
- ✅ deployFullStackMode() function is independent and testable

**User Story 3**:
- ✅ Dockerfile generated during `light init`
- ✅ App container builds from Dockerfile
- ✅ App container runs and is accessible via HTTPS
- ✅ `docker-compose.deployment.yml` includes app service

**User Story 4**:
- ✅ Development mode shows "Start your app" message
- ✅ Deployment mode does NOT show "Start your app" message
- ✅ Deployment mode shows SSL info message when using mkcert
- ✅ Error messages are mode-appropriate
- ✅ User guidance is contextually helpful

**Overall Success**:
- ✅ All Spec 001 functionality preserved (backward compatible)
- ✅ Clear code separation between development and deployment modes
- ✅ `docker-compose.production.yml` renamed to `docker-compose.deployment.yml`
- ✅ All quickstart.md test scenarios pass
- ✅ All constitutional principles followed
- ✅ Test coverage maintained (unit + contract tests)
