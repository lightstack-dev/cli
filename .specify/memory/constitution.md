<!--
Sync Impact Report:
Version: 1.0.0 → 1.1.0
Change Type: MINOR (new principles added)
Modified Principles: None (all existing principles preserved)
Added Sections:
  - XI. Spec-Driven Development (new Development Principle)
  - XII. Test-Driven Development (new Quality Standard)
  - XIII. Test What We Own (new Quality Standard)
Templates Requiring Updates:
  ✅ plan-template.md - Constitution Check section already generic, no update needed
  ✅ spec-template.md - Already aligns with principles (WHAT not HOW)
  ✅ tasks-template.md - Already includes test-first guidance, now backed by constitution
  ✅ Commands (*.md) - No agent-specific references to update
Follow-up TODOs: None
Rationale: Added three development workflow principles from CLAUDE.md that were
operating as de facto constitutional rules but not formally documented. These
principles (spec-driven, test-driven, test boundaries) are enforced in practice
and referenced in templates, so codifying them ensures consistency.
Date: 2025-10-09
-->

# Lightstack CLI Constitution

## Core Principles

### I. Don't Reinvent the Wheel (NON-NEGOTIABLE)

- Use existing, battle-tested tools for complex tasks
- Traefik/Caddy for reverse proxy and SSL
- Docker for containerization
- mkcert for local certificates
- Established CLI frameworks for argument parsing
- If a tool does it well, orchestrate it, don't reimplement it

### II. Configuration Over Code

- Generate configuration files for existing tools
- Users can understand and modify what we generate
- No hidden magic or black boxes
- All generated files are version-controllable

### III. Single Responsibility

- The CLI orchestrates; it doesn't try to be everything
- Each command does one thing well
- Complex operations are compositions of simple ones
- Leave specialized work to specialized tools

### IV. Fail Fast, Fail Clearly

- Validate prerequisites before starting operations
- Error messages must include what went wrong AND how to fix it
- No silent failures or cryptic errors
- Exit codes follow standard conventions

### V. Progressive Disclosure

- Start with smart defaults that work for 80% of cases
- Allow overrides for power users
- Hide complexity behind `--advanced` flags
- Quickstart in <5 minutes, mastery when needed

## Development Principles

### VI. Stand on Shoulders of Giants

- Use established libraries over custom implementations
- Follow existing CLI conventions (--help, --version, etc.)
- Adopt industry standards for config files
- Learn from successful CLIs (npm, docker, git)

### VII. Idempotent Operations

- Running a command twice has the same effect as running it once
- Always check current state before making changes
- Support --dry-run for destructive operations
- Make operations resumable after failures

### VIII. Environment Awareness

- Respect CI environment variables
- Honor NO_COLOR and other accessibility standards
- Detect and adapt to platform differences
- Work offline when possible

### IX. Spec-Driven Development

- Read specifications before writing code
- Specs live in `specs/00X-name/` (spec.md, plan.md, tasks.md)
- Update specs before implementing changes
- When fixing issues, check if implementation diverged from spec
- Specs document what we're building NOW, not distant future
- Small specs (10-15 tasks) ship faster than large specs (100+ tasks)

## Quality Standards

### X. Developer Experience First

- Every error suggests a solution
- Progress feedback for long operations
- Verbose mode for debugging
- Commands are guessable and memorable

### XI. Maintainability

- Code should be obvious, not clever
- Documentation lives next to code
- Tests prove the feature works
- Refactor when complexity grows

### XII. Test-Driven Development

- All tests must pass before every commit
- Write tests before implementation when practical
- Tests must fail before implementation to prove they work
- No TypeScript errors (`bun run typecheck`)
- No linting errors (`bun run lint`)

### XIII. Test What We Own

**Philosophy**: Test our orchestration logic, not external tools.

**DO Test**:

- Configuration generation (correct YAML/JSON output?)
- Command building (correct arguments to external tools?)
- Input validation (correct error messages?)
- Business logic unique to this CLI

**DON'T Test**:

- External tool behavior (Does Docker actually start containers?)
- Third-party library internals (Does mkcert generate valid certs?)
- System integration (End-to-end Docker execution)

**Rationale**: We orchestrate; we don't own Docker, mkcert, or Traefik. Test
our orchestration is correct. Trust the tools to do their jobs.

**Target Distribution**: 94% unit tests, 6% contract tests, 0% E2E tests
(manual testing for Docker integration).

## Governance

- Constitution supersedes all implementation decisions
- Violations must be justified in writing
- Amendments require clear rationale and migration path
- Simplicity wins in disputes

**Version**: 1.1.0 | **Ratified**: 2025-09-18 | **Last Amended**: 2025-10-09
