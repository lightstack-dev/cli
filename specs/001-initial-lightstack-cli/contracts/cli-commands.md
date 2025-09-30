# CLI Command Contracts

**Version**: 1.0.0
**Date**: 2025-09-18

## Command Overview

Lightstack CLI provides focused commands for development workflow orchestration. It does not pass through commands to other tools - users interact with BaaS CLIs directly for their specific needs.

```bash
light init [project-name]     # Initialize new project
light up                      # Start development environment
light deploy [environment]    # Deploy to target environment
light env <subcommand>         # Manage deployment environments
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
2. Create `light.config.yml` with default configuration
3. Generate base Docker Compose files
4. Create `.env` template (environment files created on demand)
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

**Purpose**: Start development environment (local or remote via `--env` flag)

**Inputs**:
- `--env <name>`: Deployment target environment from light.config.yml (e.g., development, production, staging, uat)
- `--build`: Force rebuild of containers
- `--detach`: Run in background (default: true)

**Environment Resolution**:
- Values come from configured `deployments` in light.config.yml
- Defaults to 'development' if none specified
- If specified environment not found, prompts user to configure it via `light env add`
- Environment determines which Docker Compose overrides to use (dev.yml, prod.yml, staging.yml, etc.)

**Behavior**:
1. Validate Lightstack project exists (light.config.yml)
2. Check if specified environment is configured; if not, offer to run `light env add`
3. Check Docker daemon is running
4. Validate all service dependencies
5. Generate environment-specific Docker Compose override if needed
6. Execute: `docker compose -f docker-compose.yml -f docker-compose.<env>.yml up -d`
7. Wait for health checks to pass
8. Display service URLs and status

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
- `environment` (optional): Deployment target from light.config.yml, defaults to 'production'
- `--dry-run`: Show what would be deployed without executing
- `--build`: Force rebuild before deployment
- `--rollback`: Rollback to previous deployment
- `--tag <git-tag>`: Specific git tag to deploy (optional, defaults to current commit)

**Behavior** (GitOps Approach):
1. Validate target environment exists in configuration
2. Validate deployment prerequisites (SSH access, Docker on target, git repository)
3. SSH to target server
4. Navigate to project directory (`cd /opt/project`)
5. Checkout specified git tag/commit (`git checkout v1.2.3`)
6. Execute identical command remotely (`light up --env production`)
7. Run health checks and report deployment status

**Key Innovation**: Same `light up` command works locally and remotely - perfect dev/prod parity

**Example Usage**:
```bash
# Deploy to different configured environments
light deploy staging --tag v1.2.3
light deploy uat --tag v1.3.0-beta
light deploy production --tag v1.2.3

# What happens on each target server:
ssh staging.myproject.com "cd /opt/project && git checkout v1.2.3 && light up --env staging"
ssh uat.myproject.com "cd /opt/project && git checkout v1.3.0-beta && light up --env uat"
ssh myproject.com "cd /opt/project && git checkout v1.2.3 && light up --env production"
```

**Success Output**:
```
✓ Connecting to production server (myapp.com)
✓ Checking out git tag v1.2.3
✓ Starting production environment (light up --env production)
✓ Complete BaaS stack deployed (PostgreSQL, Auth, API, Storage, Studio)
✓ Health checks passed
✓ Deployment complete

Application available at: https://myapp.com
BaaS API available at: https://api.myapp.com
Database Studio at: https://studio.myapp.com
Git tag deployed: v1.2.3
```

**Error Conditions**:
- Environment not configured (show configuration guide)
- Build failures (show build logs)
- SSH connection failures (show connection diagnostics)
- Health check failures (automatic rollback triggered)

### `light env <subcommand>`

**Purpose**: Manage deployment environments configuration

**Subcommands**:
- `light env add <name>`: Add a new deployment environment
- `light env list`: List all configured environments
- `light env remove <name>`: Remove an environment

#### `light env add <name>`

**Purpose**: Add a new deployment environment to light.config.yml

**Inputs**:
- `name`: Environment name (e.g., production, staging, uat)
- `--host <host>`: SSH host address
- `--domain <domain>`: Domain name for this environment
- `--user <user>`: SSH user (defaults to ubuntu)
- `--port <port>`: SSH port (defaults to 22)
- `--no-ssl`: Disable SSL
- `--ssl-email <email>`: Email for Let's Encrypt SSL

**Behavior**:
1. Validate environment name (lowercase, alphanumeric, hyphens only)
2. Check environment doesn't already exist
3. Collect configuration via interactive prompts or command line options
4. Add deployment configuration to light.config.yml
5. Preserve existing configuration and formatting

**Interactive Flow** (when run without options):
```
📍 Deployment target configuration for 'production'

Host (SSH address): prod.myserver.com
Domain: example.com
SSH user [ubuntu]: deploy
SSH port [22]:
Enable SSL [Y/n]: y
SSL provider [letsencrypt]:
SSL email: admin@example.com

✅ Added 'production' environment to light.config.yml

To deploy: light deploy production
To edit: Update the configuration in light.config.yml
```

**Success Output**:
```
✅ Added 'production' environment to light.config.yml

To deploy: light deploy production
To edit: Update the configuration in light.config.yml
```

#### `light env list`

**Purpose**: List all configured deployment environments

**Success Output**:
```
Configured environments:

● production
  Host: prod.example.com
  Domain: example.com
  User: deploy
  Port: 22
  SSL: Enabled (letsencrypt)

● staging
  Host: staging.example.com
  Domain: staging.example.com
  User: ubuntu
  Port: 22
  SSL: Disabled

Deploy with: light deploy <environment>
Edit in: light.config.yml
```

#### `light env remove <name>`

**Purpose**: Remove a deployment environment

**Inputs**:
- `name`: Environment name to remove
- `--force`: Skip confirmation

**Behavior**:
1. Validate environment exists
2. Confirm deletion (unless --force)
3. Remove from light.config.yml
4. Preserve other configuration

**Success Output**:
```
✅ Removed 'staging' environment
```

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