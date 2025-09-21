# Claude Code Context: Lightstack CLI

## Project Overview

**Lightstack CLI** (`@lightstack-dev/cli`) is a focused command-line tool that orchestrates development workflows for BaaS (Backend-as-a-Service) applications. It generates Docker Compose configurations and leverages existing tools rather than reimplementing functionality.

### Core Philosophy
- **Don't Reinvent the Wheel**: Use Traefik for SSL, Docker Compose for orchestration, mkcert for local certs
- **Configuration Over Code**: Generate files users can understand and modify
- **Single Responsibility**: Orchestrate workflows, don't try to be everything

## Current Architecture

### Command Structure
```
light init [project-name]    # Initialize new project
light up                     # Start development environment
light deploy [environment]   # Deploy to target environment
light status                 # Show project/service status
light logs [service]         # Show service logs
light down                   # Stop development environment
```

### Technology Stack
- **Language**: TypeScript/Node.js 20+
- **CLI Framework**: Commander.js
- **Docker**: Shell out to `docker compose` commands
- **SSL**: Traefik (production) + mkcert (local development)
- **Testing**: Vitest
- **Distribution**: npm registry as `@lightstack-dev/cli`

### File Structure
```
project-root/
├── light.config.json         # Main configuration
├── .env.development          # Dev environment variables
├── .env.production           # Prod environment variables
└── .light/                   # Generated files
    ├── docker-compose.yml    # Base services
    ├── docker-compose.dev.yml # Dev overrides
    ├── docker-compose.prod.yml # Prod overrides
    └── certs/                # mkcert certificates
```

## Implementation Guidelines


### Constitutional Principles
1. **Don't Reinvent the Wheel**: If a tool does it well, orchestrate it
2. **Configuration Over Code**: Generate configs for existing tools
3. **Single Responsibility**: CLI orchestrates; doesn't become Swiss Army knife
4. **Fail Fast, Fail Clearly**: Validate prerequisites; provide actionable errors
5. **Progressive Disclosure**: Smart defaults; allow overrides

### Error Handling Pattern
```
❌ Error: [What went wrong]

Cause: [Why it happened]
Solution: [How to fix it]

For more help: light [command] --help
```

### File Generation Strategy
- Generate Docker Compose files from project configuration
- Use Traefik labels for routing and SSL
- Template-based generation (simple string replacement, not complex templating)
- Users should be able to understand and modify generated files

## Current Implementation Status

### Completed (Design Phase)
- ✅ Project specification and requirements
- ✅ Technical architecture decisions
- ✅ Command contracts and behavior definitions
- ✅ Data model for project entities
- ✅ Quickstart user workflow validation

### Key Design Decisions Made
- **Docker Compose**: Generate files + shell out (not Dockerode SDK)
- **SSL Strategy**: Traefik handles all SSL (Let's Encrypt prod, mkcert local)
- **No Plugin System**: Start simple, YAGNI principle
- **No Service Layer**: Commands work directly, avoid overengineering
- **BaaS Integration**: Decided against wrapping other CLIs

### Next Implementation Phase
When ready for implementation, prioritize:
1. `light init` command (project scaffolding)
2. `light up` command (development environment)
3. Basic Docker Compose generation
4. mkcert integration for local SSL
5. Traefik configuration generation

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

### Test Structure
```
tests/
├── unit/          # Pure functions, utilities
├── integration/   # Command execution, file generation
└── e2e/           # Full workflow scenarios
```

### Key Test Areas
- Configuration validation and schema compliance
- Docker Compose file generation accuracy
- Command flag parsing and validation
- Error handling and user messaging
- File system operations and cleanup

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

- **CLI Name**: Changed from `lightstack` to `light` for better typing experience
- **BaaS Integration**: Decided against wrapping other CLIs (Supabase, etc.)
- **Package Name**: `@lightstack-dev/cli` in npm registry
- **SSL Approach**: Simplified to Traefik-only (no custom cert management)

---

This context provides the foundation for implementing the Lightstack CLI according to established patterns and principles. Focus on simplicity, user experience, and leveraging existing tools effectively.