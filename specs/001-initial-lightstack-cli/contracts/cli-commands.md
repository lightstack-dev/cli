# CLI Command Contracts

**Version**: 1.0.0
**Date**: 2025-09-18

## Command Overview

Lightstack CLI provides focused commands for self-hosted Supabase deployment orchestration. It does not pass through commands to Supabase CLI - users interact with Supabase CLI directly for migrations and database management.

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

**Note**: Unknown commands will result in an error with helpful suggestions. For Supabase-specific operations (e.g., migrations, db push), use Supabase CLI directly.

## Command Specifications

### `light init [project-name]`

**Purpose**: Initialize a new Lightstack project in current directory

**Inputs**:
- `project-name` (optional): Project name, defaults to current directory name
- `--template <name>`: Project template (nuxt, sveltekit), defaults to nuxt
- `--force`: Overwrite existing configuration

**Behavior**:
1. Validate project name (URL-safe, no spaces)
2. Prompt for ACME email (for Let's Encrypt SSL certificates)
   - Stored in `~/.lightstack/config.yml` (user config, NOT project)
   - Used across all projects on this machine
3. Create `light.config.yml` with default configuration (NO PII)
4. Generate base Docker Compose files (base, development, production)
5. Generate Dockerfile for production builds
6. Install mkcert and generate local certificates
7. Display next steps to user

**Success Output**:
```
✓ Project 'my-app' initialized
✓ Docker Compose files generated
✓ Dockerfile created for production builds
✓ Local certificates created
✓ ACME email saved to user config (~/.lightstack/config.yml)

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
  - `development`: Self-hosted Supabase stack if Supabase project detected (standard proxy mode otherwise)
  - `production`: Full self-hosted Supabase stack for local production testing
- `--detach`: Run in background (default: true)

**Environment Resolution**:
- Development (default): Self-hosted Supabase stack if `supabase/` directory exists (proxy mode for non-Supabase projects)
- Production/other: Generates complete self-hosted Supabase stack from config
- **Note**: Supabase project (supabase/ directory) is required for production mode

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
   - If not configured → Run `light env add production` interactively
3. Check for DNS_API_KEY in .env
   - If missing → Prompt for DNS API key and save to .env
4. Read ACME_EMAIL from ~/.lightstack/config.yml
5. Start complete production stack locally (using docker-compose.production.yml)
   - Domain: local.lightstack.dev
   - Let's Encrypt DNS challenge (real certificate)
   - Containerized app (built from Dockerfile)
   - All Supabase services
6. Apply database migrations automatically
7. Display URLs

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
  ✓ https://app.local.lightstack.dev      → Containerized app
  ✓ https://api.local.lightstack.dev      → Supabase API
  ✓ https://studio.local.lightstack.dev   → Supabase Studio

Database migrations applied
Production secrets in .env (gitignored)
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
   - If not configured → Run `light env add <environment>` interactively
2. **Confirmation prompt for production**: "Deploy to production? [y/N]"
3. Validate deployment prerequisites (SSH access, Docker on target, git repository)
4. SSH to target server
5. Clone repository on first deploy (`git clone` to `/opt/project`)
   - Subsequent deploys: navigate to existing directory
6. Checkout specified git tag/commit (`git checkout v1.2.3`)
7. Check for `.env` on server
   - If missing → Prompt for DNS_API_KEY and other secrets
   - Generate production secrets and save to server's `.env`
8. Copy ACME_EMAIL from `~/.lightstack/config.yml` to server environment
9. Execute identical command remotely (`light up production`)
10. Run health checks and report deployment status

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
- `--host <host>`: SSH host address (optional, defaults to domain)
- `--domain <domain>`: Domain name for this environment
- `--user <user>`: SSH user (defaults to ubuntu)
- `--port <port>`: SSH port (defaults to 22)
- `--no-ssl`: Disable SSL
- `--dns-provider <provider>`: DNS provider for Let's Encrypt (cloudflare, route53, etc.)
- `--dns-api-key <key>`: DNS API key for DNS challenge

**Behavior**:
1. Validate environment name (lowercase, alphanumeric, hyphens only)
2. Check environment doesn't already exist
3. Collect configuration via interactive prompts or command line options
4. Add deployment configuration to light.config.yml (NO secrets)
5. Save DNS_API_KEY to .env (gitignored)
6. Preserve existing configuration and formatting

**Interactive Flow** (when run without options):
```
📍 Deployment target configuration for 'production'

Domain (public domain): example.com
SSH host [example.com]:
SSH user [ubuntu]: deploy
SSH port [22]:
Enable SSL [Y/n]: y
SSL provider [letsencrypt]:
DNS provider (for Let's Encrypt): cloudflare
DNS API key: ********************

✅ Added 'production' environment to light.config.yml
✅ DNS API key saved to .env (gitignored)

ACME email already configured: dev@example.com (from ~/.lightstack/config.yml)

To test locally: light up production
To deploy: light deploy production
To edit: Update the configuration in light.config.yml
```

**Success Output**:
```
✅ Added 'production' environment to light.config.yml
✅ DNS API key saved to .env

To test locally: light up production
To deploy: light deploy production
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

For Supabase-specific operations, use the Supabase CLI directly:
  supabase init           # Initialize Supabase project
  supabase migration new  # Create new migration
  supabase db push        # Apply migrations

Lightstack CLI handles infrastructure deployment only.
For help: light --help
```

---

These contracts define the expected behavior without implementation details. Each command should be predictable, helpful, and follow CLI conventions.