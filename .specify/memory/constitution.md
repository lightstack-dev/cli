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

## Quality Standards

### IX. Developer Experience First
- Every error suggests a solution
- Progress feedback for long operations
- Verbose mode for debugging
- Commands are guessable and memorable

### X. Maintainability
- Code should be obvious, not clever
- Documentation lives next to code
- Tests prove the feature works
- Refactor when complexity grows

## Governance

- Constitution supersedes all implementation decisions
- Violations must be justified in writing
- Amendments require clear rationale and migration path
- Simplicity wins in disputes

**Version**: 1.0.0 | **Ratified**: 2025-09-18 | **Last Amended**: N/A