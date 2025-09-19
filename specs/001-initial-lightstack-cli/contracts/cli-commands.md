# CLI Command Contracts

**Version**: 1.0.0
**Date**: 2025-09-18

## Command Overview

Lightstack CLI provides focused commands for development workflow orchestration. It does not pass through commands to other tools - users interact with BaaS CLIs directly for their specific needs.

```bash
light init [project-name]     # Initialize new project
light up                      # Start development environment
light deploy [environment]    # Deploy to target environment
light status                  # Show project and services status
light logs [service]          # Show service logs
light down                    # Stop development environment
light --help                  # Show help
light --version               # Show version
```

**Note**: Unknown commands will result in an error with helpful suggestions. For BaaS-specific operations (e.g., Supabase migrations), use the respective CLI tools directly.

## Command Specifications

### `light init [project-name]`

**Purpose**: Initialize a new Lightstack project in current directory

**Inputs**:
- `project-name` (optional): Project name, defaults to current directory name
- `--template <name>`: Project template (nuxt, sveltekit), defaults to nuxt
- `--force`: Overwrite existing configuration

**Behavior**:
1. Validate project name (URL-safe, no spaces)
2. Create `light.config.json` with default configuration
3. Generate base Docker Compose files
4. Create `.env.development` and `.env.production` templates
5. Install mkcert and generate local certificates
6. Display next steps to user

**Success Output**:
```
✓ Project 'my-app' initialized
✓ Docker Compose files generated
✓ Local certificates created
✓ Environment files created

Next steps:
  light up              # Start development
  supabase init         # Set up Supabase (if using)
```

**Error Conditions**:
- Directory already contains Light project (suggest --force)
- Invalid project name (show naming rules)
- Docker not available (show installation instructions)
- mkcert installation fails (show manual setup)

### `light up`

**Purpose**: Start local development environment

**Inputs**:
- `--env <name>`: Environment to use, defaults to 'development'
- `--build`: Force rebuild of containers
- `--detach`: Run in background (default: true)

**Behavior**:
1. Validate Lightstack project exists (light.config.json)
2. Check Docker daemon is running
3. Validate all service dependencies
4. Generate docker-compose.dev.yml with current configuration
5. Execute: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`
6. Wait for health checks to pass
7. Display service URLs and status

**Success Output**:
```
✓ Docker daemon running
✓ Validating service configuration
✓ Starting services...
  ↳ traefik (reverse proxy)    https://localhost
  ↳ my-app (frontend)          https://my-app.lvh.me
  ↳ supabase (database)        https://supabase.lvh.me

All services running. Press Ctrl+C to stop.
```

**Error Conditions**:
- No Lightstack project found (suggest `light init`)
- Docker not running (show start instructions)
- Port conflicts (suggest alternatives)
- Service startup failures (show logs and troubleshooting)

### `light deploy [environment]`

**Purpose**: Deploy application to specified environment

**Inputs**:
- `environment` (optional): Target environment, defaults to 'production'
- `--dry-run`: Show what would be deployed without executing
- `--build`: Force rebuild before deployment
- `--rollback`: Rollback to previous deployment

**Behavior**:
1. Validate target environment exists in configuration
2. Validate deployment prerequisites (SSH access, Docker on target)
3. Build application containers
4. Generate production Docker Compose files
5. Upload files to target server
6. Execute deployment with zero-downtime strategy
7. Run health checks
8. Report deployment status

**Success Output**:
```
✓ Building containers...
✓ Uploading to production server
✓ Deploying with zero downtime
✓ Health checks passed
✓ Deployment complete

Application available at: https://myapp.com
Deployment ID: dep_2025091801
```

**Error Conditions**:
- Environment not configured (show configuration guide)
- Build failures (show build logs)
- SSH connection failures (show connection diagnostics)
- Health check failures (automatic rollback triggered)

### `light status`

**Purpose**: Show current project and service status

**Inputs**:
- `--format <format>`: Output format (table, json), defaults to table

**Behavior**:
1. Read current project configuration
2. Check Docker container status for each service
3. Query health check endpoints
4. Display formatted status information

**Success Output**:
```
Project: my-app (development)

Services:
┌──────────┬──────────┬─────────────────────┬──────────┐
│ Service  │ Status   │ URL                 │ Health   │
├──────────┼──────────┼─────────────────────┼──────────┤
│ traefik  │ running  │ https://localhost   │ healthy  │
│ my-app   │ running  │ https://my-app.localhost │ healthy  │
│ supabase │ running  │ https://supabase.localhost │ healthy  │
└──────────┴──────────┴─────────────────────┴──────────┘

Deployment Targets:
• production: https://myapp.com (last deployed: 2 hours ago)
```

### `light logs [service]`

**Purpose**: Show logs from services

**Inputs**:
- `service` (optional): Specific service name, defaults to all services
- `--follow`: Follow log output in real-time
- `--tail <lines>`: Number of lines to show, defaults to 50

**Behavior**:
1. Validate service exists (if specified)
2. Execute: `docker compose logs [service]` with appropriate flags
3. Format and display log output

### `light down`

**Purpose**: Stop development environment

**Inputs**:
- `--volumes`: Remove volumes as well (data loss warning)

**Behavior**:
1. Execute: `docker compose down`
2. Optionally remove volumes if requested
3. Display stop confirmation

**Success Output**:
```
✓ Stopping services...
✓ Development environment stopped
```

## Global Options

All commands support:
- `--help`: Show command-specific help
- `--verbose`: Detailed output for debugging
- `--quiet`: Minimal output
- `--no-color`: Disable colored output (respects NO_COLOR env var)

## Exit Codes

- `0`: Success
- `1`: General error
- `2`: Configuration error
- `3`: Docker/dependency error
- `4`: Network/deployment error
- `5`: User cancellation

## Error Message Format

All error messages follow this pattern:
```
❌ Error: [What went wrong]

Cause: [Why it happened]
Solution: [How to fix it]

For more help: light [command] --help
```

## Command Aliases

For convenience:
- `light start` → `light up`
- `light stop` → `light down`
- `light ps` → `light status`

## Unknown Commands

When an unknown command is provided, Lightstack CLI will:
1. Display an error message
2. Suggest similar known commands (if applicable)
3. Show how to get help
4. NOT pass through to other tools

**Example**:
```bash
$ light supabase init
❌ Error: Unknown command 'supabase'

Did you mean one of these?
  light status
  light up

For Supabase operations, use the Supabase CLI directly:
  supabase init

For help: light --help
```

---

These contracts define the expected behavior without implementation details. Each command should be predictable, helpful, and follow CLI conventions.