# Implementation Plan: Lightstack CLI Core Foundation

**Branch**: `001-initial-lightstack-cli` | **Date**: 2025-09-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-initial-lightstack-cli/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code)
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Building a unified CLI tool that orchestrates self-hosted Supabase deployment from local development through production deployment, focusing on Nuxt/Supabase stack with Docker-based deployment. Currently Supabase-only (other BaaS platforms may be added later if needed - YAGNI).

## Technical Context
**Language/Version**: TypeScript/Node.js 20+ (standard for modern CLI tools)
**Primary Dependencies**: Commander.js (CLI framework), Docker Compose (shell commands), mkcert/Let's Encrypt
**Storage**: YAML config (light.config.yml), user config (~/.lightstack/config.yml), secrets (.env)
**Testing**: Vitest (fast, ESM-native test runner)
**Documentation**: VitePress static site generator, deployed to https://cli.lightstack.dev
**Target Platform**: macOS, Linux, Windows with WSL2
**Project Type**: single (CLI tool)
**Performance Goals**: <2s response time for local operations, <30s for deployment operations
**Constraints**: Must work in CI environments, respect NO_COLOR, handle network failures gracefully
**Scale/Scope**: Supporting early-stage Supabase apps (first thousands of users)
**BaaS Platform**: Supabase (required) - other platforms may be added if demand exists (YAGNI)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since no constitution is defined yet for this project, we'll establish initial principles:
- [ ] Simplicity first (YAGNI principle)
- [ ] User-facing operations must be idempotent
- [ ] All operations must be resumable after failure
- [ ] Configuration as code (version-controllable)
- [ ] Stand on shoulders of giants (use established libraries)

## Project Structure

### Documentation (this feature)
```
specs/001-initial-lightstack-cli/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Option 1 (single project) - This is a CLI tool, not a web application

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Best practices for TypeScript CLI development
   - Docker SDK integration patterns
   - Let's Encrypt automation in Node.js
   - CI/CD file generation strategies
   - Self-update mechanisms for Node.js CLIs

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

6. **Design documentation infrastructure** (for NFR-001):
   - Select static site generator (VitePress for Vue ecosystem alignment)
   - Plan documentation structure (guides, API reference, examples)
   - Design CI/CD pipeline for automated deployment
   - Define hosting strategy for https://cli.lightstack.dev
   - Create templates for auto-generated command docs

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file, docs infrastructure plan

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass
- Documentation site setup and deployment tasks
- CI/CD pipeline for docs.lightstack.dev

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Models before services before UI
- Documentation can parallel once CLI structure exists
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 70-80 numbered, ordered tasks in tasks.md (includes docs infrastructure)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations - following YAGNI and simplicity principles throughout.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*