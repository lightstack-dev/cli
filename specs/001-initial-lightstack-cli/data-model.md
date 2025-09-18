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
- Server connection details
- Domain configuration for SSL
- Rollback preferences

**Key rules:**
- Target names must be unique within a project
- Each target has its own environment variables
- Targets can have different SSL configurations

### Environment
Environment-specific configuration for variables and secrets.

**What it contains:**
- Variable definitions for the environment
- References to secrets (not the actual secret values)

**Key rules:**
- Environment names match deployment target names
- Secret values never stored in configuration files
- Variables can be overridden per environment

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
project-root/
├── light.config.json     # Main project configuration
├── .env.development      # Development environment variables
├── .env.production       # Production environment variables
└── .light/               # CLI-generated files
    ├── docker-compose.yml
    ├── docker-compose.dev.yml
    ├── docker-compose.prod.yml
    ├── certs/             # mkcert certificates for *.lvh.me
    └── deployments/       # Deployment history
```

### Generated Docker Compose
Lightstack CLI generates Docker Compose files based on the project configuration:

- **Base file**: Common service definitions
- **Environment overlays**: Environment-specific overrides
- **Traefik labels**: Routing and SSL configuration

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