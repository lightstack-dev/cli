# Data Model: Lightstack CLI

**Version**: 1.0.0
**Date**: 2025-09-18

## Core Entities

### Project
A Lightstack project represents a web application being developed and deployed.

**What it contains:**
- Basic information (name, type)
- List of services that make up the application
- Deployment destinations
- Environment-specific settings

**Key rules:**
- Every project must have at least one service
- Project names must be unique and URL-safe
- Projects can have multiple deployment targets

### Service
A service is a component of the application (frontend, database, BaaS, etc.).

**What it contains:**
- Identity (name, type)
- Runtime information (port, commands)
- Dependencies on other services

**Key rules:**
- Service names must be unique within a project
- Services can depend on other services
- Circular dependencies are forbidden
- Each service runs in its own container

### Deployment Target
A deployment target represents where the application can be deployed.

**What it contains:**
- Environment name (production, staging, etc.)
- Server connection details (host, user, port)
- Domain configuration for SSL
- DNS provider for Let's Encrypt (cloudflare, route53, etc.)
- Rollback preferences

**What it does NOT contain (stored separately):**
- ACME email (in `~/.lightstack/config.yml` - PII)
- DNS API key (in `.env` - secret)
- Other secrets (in `.env` - secret)

**Key rules:**
- Target names must be unique within a project
- Each target has separate secrets in local vs remote `.env`
- Targets can have different SSL and DNS configurations

### Environment Configuration
Environment-specific deployment configuration that maps to deployment targets.

**What it contains:**
- Deployment target type (local, remote)
- Docker Compose file combinations
- Runtime configuration (not secrets)

**Key rules:**
- Environment names must match deployment target names
- Environment variables managed separately by users
- Each environment defines its Docker Compose file strategy

**Example Configuration (light.config.yml):**
```yaml
name: my-project
services:
  - name: app
    type: nuxt
    port: 3000

deployments:
  - name: development    # light up --env development
    type: local
    domain: lvh.me
  - name: staging        # light up --env staging
    type: remote
    host: staging.myproject.com
    domain: staging.myproject.com
  - name: production     # light up --env production
    type: remote
    host: myproject.com
    domain: myproject.com
  - name: uat           # light up --env uat
    type: remote
    host: uat.myproject.com
    domain: uat.myproject.com
```

## Relationships

```
Project
├── Services (1 to many)
│   └── Dependencies (service to service)
├── Deployment Targets (1 to many)
└── Environments (1 to many, matching targets)
```

**Service Dependencies:**
- Services can depend on other services
- Dependencies form a directed graph (no cycles)
- Dependency order determines startup sequence

**Environment Mapping:**
- Each deployment target has a corresponding environment
- Environments hold target-specific configuration
- Variables can be shared or target-specific

## State Transitions

### Service Lifecycle
```
Configured → Starting → Running → Stopping → Stopped
                ↓
              Failed
```

### Deployment Process
```
Initiated → Building → Deploying → Health Check → Complete
                                        ↓
                                    Failed → Rollback
```

## File Storage

### Configuration Files
```
~/.lightstack/
└── config.yml           # User config (ACME email - PII, not in project)

project-root/
├── light.config.yml     # Main project configuration (YAML, NO secrets)
├── .env                  # Secrets (DNS_API_KEY, etc. - gitignored)
├── Dockerfile            # Production build configuration
├── supabase/             # Supabase project files (if using Supabase)
│   └── config.toml       # Supabase configuration (used for detection)
└── .light/               # CLI-generated files
    ├── docker-compose.yml           # Base Docker Compose configuration
    ├── docker-compose.development.yml # Development overrides
    ├── docker-compose.production.yml  # Production overrides (full stack)
    ├── certs/             # Local SSL certificates (mkcert)
    ├── traefik/           # Traefik dynamic configuration
    │   └── dynamic.yml    # BaaS proxy routes (generated when BaaS detected)
    └── deployments/       # Deployment history and state
```

### Environment Variable Strategy (12-Factor Principles)
- **User config for PII**: `~/.lightstack/config.yml` stores ACME_EMAIL (PII, not in project)
- **Project .env for secrets**: CLI writes DNS_API_KEY to `.env` when configuring environments
- **No secret copying**: Local and remote environments have separate `.env` files
- **Local development**: `.env` file used automatically via `--env-file ./.env`
- **Remote deployments**: Servers have their own `.env` (CLI prompts for secrets on first deploy)
- **Secrets separation**: Production secrets never in config files or git

### Generated Docker Compose
Lightstack CLI generates Docker Compose files based on the project configuration:

- **Base file**: Common service definitions
- **Environment overlays**: Environment-specific overrides
- **Traefik routing**: Via file provider for SSL proxy configuration

### Complete Self-Hosted Supabase Stack (Required)
When Supabase projects are detected, Lightstack deploys the complete self-hosted stack:

**Detection Strategy**:
- Check for `supabase/` directory → Self-hosted Supabase stack enabled
- Currently Supabase-only (other BaaS platforms may be added later if needed - YAGNI)

**Complete Supabase Stack Deployment**:
- **PostgreSQL Database** with persistent volumes and proper backup procedures
- **Supabase Auth (GoTrue)** for authentication and user management
- **Supabase API (PostgREST)** for database REST API
- **Supabase Storage** for file storage and management
- **Supabase Studio** for database administration interface
- **Supabase Realtime** for WebSocket subscriptions
- **Kong API Gateway** for request routing and security
- **Additional services**: Image proxy, edge functions, analytics

**Infrastructure Strategy**:
- Generate complete Docker Compose with 10+ Supabase services
- Development: All services containerized with development settings
- Production: Same containers with production settings and persistent volumes
- Traefik handles SSL termination and routing to all services

**URL Strategy (Self-Hosted)**:
```
Development:                Production:
https://studio.lvh.me      →  https://studio.yourdomain.com
https://api.lvh.me         →  https://api.yourdomain.com
https://storage.lvh.me     →  https://storage.yourdomain.com
https://app.lvh.me         →  https://yourdomain.com
```

**Database Persistence**:
- Development: PostgreSQL data in local Docker volumes
- Production: PostgreSQL data in persistent server volumes with backup strategy
- Migrations: Supabase migration files applied to both environments identically

## Data Validation Rules

### Project Level
- Name must be valid for domains and file paths
- Must define at least one service
- Must define at least one deployment target

### Service Level
- Ports must be available and in valid range (1000-65535)
- Dependencies must reference existing services
- No circular dependency chains allowed

### Deployment Level
- Hostnames must be valid FQDNs or IP addresses
- SSL domains must be valid domain names
- Environment variables must follow naming conventions

## Configuration Schema Evolution

### Versioning Strategy
- Configuration files include schema version
- CLI validates configuration against expected schema
- Automatic migration for minor version changes
- Breaking changes require explicit migration commands

### Migration Process
```bash
light migrate                    # Check for needed migrations
light migrate --from=1.0 --to=1.1  # Execute specific migration
```

## Database Persistence Strategy

### Development Environment
- **PostgreSQL container** with Docker named volumes
- **Ephemeral by default** - reset with `light down --volumes`
- **Schema migrations** managed by Supabase CLI
- **Test data seeding** automated on startup

### Production Environment
- **PostgreSQL container** with persistent named volumes
- **Automated backups** via scheduled Docker volume snapshots
- **Data retention** following organization policies
- **Migration strategy** using Supabase CLI in production
- **Rollback capability** preserving database state

### Data Migration Path
```bash
# Hosted Supabase to Self-Hosted Supabase Migration
pg_dump hosted_supabase_db_url > backup.sql
light up --env production
psql self_hosted_supabase_db_url < backup.sql
```

### Volume Management
```yaml
# Production Docker Compose
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      device: /var/lib/lightstack/postgres
      o: bind
```

## Error Handling

### Configuration Errors
- Invalid JSON: Show syntax error with line number
- Missing required fields: List what's missing and examples
- Invalid values: Explain constraints and provide valid examples

### Runtime Errors
- Port conflicts: Suggest alternative ports
- Missing dependencies: Show installation commands
- Service failures: Display logs and troubleshooting steps

---

This conceptual model guides implementation without dictating specific code structures. The focus is on relationships and rules that govern how Lightstack CLI manages projects, not on the technical implementation details.