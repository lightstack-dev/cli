# CLI Command Contracts

**Version**: 1.0.0
**Date**: 2025-09-18

## Command Overview

Lightstack CLI provides focused commands for development workflow orchestration. It does not pass through commands to other tools - users interact with BaaS CLIs directly for their specific needs.

```bash
light init [project-name]        # Initialize new project
light up [environment]           # Start local or production stack
light env <subcommand>           # Manage deployment targets
light status                     # Show infrastructure status
light logs [service]             # Show service logs
light down [environment]         # Stop infrastructure
light deploy [environment]       # Deploy to remote server (coming soon)
light --help                     # Show help
light --version                  # Show version
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

### `light up [environment]`

**Purpose**: Start local infrastructure (development mode) or production stack locally for testing

**Inputs**:
- `environment` (optional positional): Target environment (defaults to 'development')
  - `development`: Standard proxy mode or self-hosted BaaS if Supabase project detected
  - `production`: Full self-hosted Supabase stack for local production testing
- `--detach`: Run in background (default: true)

**Environment Resolution**:
- Development (default): Proxy mode, or self-hosted BaaS if `supabase/` directory exists
- Production/other: Generates complete self-hosted Supabase stack from config

**Behavior for Development**:
1. Validate Lightstack project exists (light.config.yml)
2. Check Docker daemon is running
3. Start Traefik proxy
4. If `supabase/` exists: Start complete self-hosted Supabase stack (8 services)
5. Apply database migrations automatically via `supabase db push`
6. Display service URLs

**Behavior for Production (local testing)**:
1. Validate prerequisites (Supabase CLI, supabase/ directory)
2. Check if environment configured in light.config.yml
3. Generate complete Supabase Docker Compose stack with secure secrets
4. Start all services with health checks
5. Apply database migrations automatically
6. Display URLs (using local.lightstack.dev domain)

**Success Output (Development)**:
```
🚀 Starting local infrastructure...
✅ Local infrastructure started

Services running:
  ✓ https://app.lvh.me          → localhost:3000
  ✓ https://api.lvh.me           → Supabase API
  ✓ https://studio.lvh.me        → Supabase Studio
  ✓ https://router.lvh.me        → Traefik dashboard

Start your app: npm run dev
Stop with: light down
```

**Success Output (Production - local testing)**:
```
🚀 Starting production stack locally...
✅ Production stack started

Services running:
  ✓ https://api.local.lightstack.dev      → Supabase API
  ✓ https://studio.local.lightstack.dev   → Supabase Studio

Database migrations applied
Secrets saved to .light/.env.supabase
Stop with: light down production
```

**Error Conditions**:
- No Lightstack project found (suggest `light init`)
- Docker not running (show start instructions)
- Production mode without Supabase project (show Supabase CLI docs)
- Supabase CLI not installed for production (show installation link)
- Container health checks fail (show recovery options and logs)
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