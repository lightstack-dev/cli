# Feature Specification: Separate Development and Deployment Workflows

**Feature Branch**: `002-separate-development-and`
**Created**: 2025-10-09
**Status**: In Development
**Input**: GitHub issue #17 - Separate development and deployment workflows

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Local Development with Proxy Mode (Priority: P1) 🎯 MVP

As a developer, I need to run `light up` (or `light up development`) and have it start only the Traefik proxy that routes HTTPS traffic to my locally-running services (Supabase CLI and my app dev server) without containerizing my application, so I can iterate quickly with hot-reload and standard development tooling.

**Why this priority**: This is the core development workflow used daily. Fast iteration is essential for developer productivity. This story represents the primary use case for local development.

**Independent Test**: Can be fully tested by running `light up`, starting Supabase CLI separately, starting the app dev server (e.g., `npm run dev`), and verifying that `https://app.lvh.me`, `https://api.lvh.me`, and `https://studio.lvh.me` all route correctly to localhost services.

**Acceptance Scenarios**:

1. **Given** a Lightstack project initialized with Supabase, **When** developer runs `light up`, **Then** only Traefik proxy starts (no Supabase containers, no app container), and HTTPS routes are configured to proxy to localhost services
2. **Given** the proxy is running and Supabase CLI is running, **When** developer accesses `https://api.lvh.me`, **Then** requests are forwarded to the Supabase CLI API on localhost
3. **Given** the proxy is running and app dev server is running on port 3000, **When** developer accesses `https://app.lvh.me`, **Then** requests are forwarded to `localhost:3000` with hot-reload working

---

### User Story 2 - Local Deployment Testing with Full Stack (Priority: P2)

As a developer, I need to run `light up <environment>` for any non-development environment (staging, production, etc.) and have it start the complete containerized stack including Supabase services in Docker containers, so I can test the containerized stack configuration locally with fast iteration (using mkcert SSL by default, optionally Let's Encrypt with `--ca letsencrypt` for full validation).

**Why this priority**: This enables testing containerization, networking, and service configuration locally before remote deployment. Fast mkcert default enables iteration; optional Let's Encrypt flag validates DNS/certificate issuance. Critical for catching deployment issues early but not needed for daily development iteration.

**Independent Test**: Can be fully tested by running `light up staging` (mkcert default) or `light up staging --ca letsencrypt` (full validation), verifying that PostgreSQL, all Supabase services (Kong, Auth, REST, Realtime, Storage, Studio, Meta, Analytics, Vector), and Traefik are running in containers with proper networking and HTTPS certificates.

**Acceptance Scenarios**:

1. **Given** a Lightstack project configured with any deployment environment, **When** developer runs `light up <environment>`, **Then** Docker starts full Supabase stack (PostgreSQL + 8 services) plus Traefik with mkcert SSL (default) and shows message about `--ca letsencrypt` option
2. **Given** a deployment environment stack is running, **When** developer accesses `https://app.local.lightstack.dev`, **Then** requests route to the containerized app and Supabase services (not localhost)
3. **Given** developer runs `light up <environment> --ca letsencrypt`, **When** Traefik starts, **Then** Let's Encrypt DNS challenge is performed and certificates are issued (validates DNS configuration)

---

### User Story 3 - App Containerization for Deployment Testing (Priority: P2)

As a developer, I need `light up <environment>` for any non-development environment to also build and run my application in a Docker container (using a user-provided Dockerfile) alongside the Supabase stack, so that what I test locally matches exactly what will run on the remote deployment target.

**Why this priority**: This completes the deployment-parity testing story. Without this, users still need to manually run `npm run dev` even in deployment mode, which defeats the purpose of deployment testing. Same priority as US2 since they work together.

**Independent Test**: Can be fully tested by running `light up staging` (or any non-development environment), verifying that the app container is built from the Dockerfile, starts successfully, and is accessible via `https://app.local.lightstack.dev` serving the containerized application (not the dev server).

**Acceptance Scenarios**:

1. **Given** a Lightstack project with a user-provided Dockerfile (created via `docker init` or manually), **When** developer runs `light up <environment>` for a non-development environment, **Then** Docker builds the app image from the Dockerfile and starts the app container alongside Supabase services
2. **Given** a deployment environment stack is running with the app container, **When** developer accesses `https://app.local.lightstack.dev`, **Then** requests route to the containerized app, not to localhost:3000
3. **Given** the app container fails to build or start, **When** error occurs, **Then** CLI shows clear error message with build logs and suggests solutions (check Dockerfile, check port conflicts, check container logs)
4. **Given** a Lightstack project without a Dockerfile, **When** developer runs `light up <environment>` for a non-development environment, **Then** CLI shows error message suggesting to create Dockerfile using `docker init` or manually, with link to documentation

---

### User Story 4 - Clear User Guidance Based on Mode (Priority: P3)

As a developer, I need the CLI to provide appropriate guidance based on which mode I'm running (development vs deployment), so I know what steps to take next without confusion.

**Why this priority**: This is UX polish that prevents confusion but doesn't block core functionality. Users can figure out the workflows even without perfect guidance.

**Independent Test**: Can be fully tested by running `light up` and verifying output says "Start your app with npm run dev", then running `light up staging` (or any non-development environment) and verifying output does NOT say this (since app is containerized).

**Acceptance Scenarios**:

1. **Given** developer runs `light up` (development mode), **When** startup completes, **Then** CLI output includes "Start your app: npm run dev" (or detected package manager equivalent)
2. **Given** developer runs `light up <environment>` for a non-development environment, **When** startup completes, **Then** CLI output does NOT include "Start your app" message (app is already containerized and running)
3. **Given** developer runs `light up <environment>` for a non-development environment and app container fails, **When** error occurs, **Then** CLI provides deployment-specific troubleshooting (check Dockerfile, check container logs, check environment variables)

---

### Edge Cases

- What happens when developer runs `light up <environment>` but that deployment environment is not configured? (System should prompt to run `light env add <environment>`)
- What happens when Supabase CLI is running and user tries to start a deployment environment stack? (System should detect port conflicts and prompt to stop Supabase CLI)
- What happens when the Dockerfile is missing or invalid during `light up <environment>` for a non-development environment? (System should generate default Dockerfile or show clear error with fix instructions)
- What happens when database migrations need to run in deployment mode? (System should apply migrations after containers start, using containerized PostgreSQL connection)
- What happens when user has a custom app port in development mode? (System should respect custom port from config when generating proxy routes)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect whether the environment is 'development' or non-development at the start of the `up` command
- **FR-002**: System MUST implement separate code paths for development mode and deployment mode (no mingling of concerns)
- **FR-003**: Development mode (`light up` or `light up development`) MUST start only Traefik proxy with file-based routing to localhost services
- **FR-004**: Development mode MUST generate dynamic Traefik configuration that proxies to `host.docker.internal` for app and Supabase CLI ports
- **FR-005**: Development mode MUST use mkcert SSL certificates
- **FR-006**: Development mode MUST NOT start any Supabase Docker containers (expect Supabase CLI to be running separately)
- **FR-007**: Development mode MUST NOT attempt to containerize the user's application
- **FR-008**: Deployment mode (`light up <env>` where env != development) MUST start full containerized Supabase stack (PostgreSQL + all 8 services)
- **FR-009**: Deployment mode MUST generate and start a Docker container for the user's application using a Dockerfile
- **FR-010**: Deployment mode MUST support SSL provider selection via `--ca <provider>` flag with values 'mkcert' (default) or 'letsencrypt', validate the provider value, show informative message for mkcert default with Let's Encrypt alternative, and configure Traefik certificate resolver accordingly (see T009a, T009b, T020, T034 for implementation details)
- **FR-011**: Deployment mode MUST use Docker-based Traefik routing (labels on containers, not file provider)
- **FR-012**: System MUST NOT generate Dockerfiles - users are responsible for providing their own
  - During `light init`, check if Dockerfile exists in project root; if missing, show informative message: "For deployment mode, you'll need a Dockerfile. Create one with: docker init (recommended) OR write a custom Dockerfile. See: https://lightstack.dev/docs/dockerfile"
  - During `light up <env>` for deployment mode, system MUST validate Dockerfile exists before attempting container build
  - If Dockerfile missing during deployment, show error: "Dockerfile required for deployment mode.\n\nCreate one using:\n  • docker init (recommended - interactive setup)\n  • Manual creation (see https://lightstack.dev/docs/dockerfile)\n\nAlternatively, use development mode: light up"
  - If Dockerfile build fails during `light up <env>`, show build logs and error: "App container build failed. Verify Dockerfile builds locally with: docker build -t myapp .\n\nDocs: https://lightstack.dev/docs/dockerfile"
- **FR-013**: System MUST detect if another Lightstack deployment is already occupying ports 80 and 443 before starting; if same environment detected, show status and exit; if different environment detected, prompt "Stop '<current>' and start '<requested>'? [Y/n]" with default YES to maintain fast workflow; only one environment can run at a time due to port conflicts
- **FR-014**: System MUST apply database migrations in deployment mode after containers start successfully
- **FR-015**: System MUST show different "Next steps" guidance based on mode (dev: "Start your app", deployment: no such message)
- **FR-016**: Refactored `up.ts` MUST have clear separation between `deployDevMode()` and `deployFullStackMode()` functions
- **FR-017**: System MUST validate that app Dockerfile exists and is valid before attempting to build in deployment mode
- **FR-018**: System MUST include app service definition in the deployment override file (`docker-compose.deployment.yml`, which applies to ALL non-development environments) with proper Traefik labels
- **FR-019**: System MUST remove misleading "Start your app with npm run dev" message from deployment mode output
- **FR-020**: System MUST generate `docker-compose.deployment.yml` (not `docker-compose.production.yml`) to reflect that it applies to all non-development environments

### Key Entities

- **Mode**: Enumeration with values 'development' or 'deployment', determined by the environment parameter to `light up`
- **SSL Provider**: Enumeration with values 'mkcert' (default) or 'letsencrypt', determined by the `--ca` flag on `light up <env>` command; controls which certificate authority Traefik uses for HTTPS
- **Proxy Configuration**: Traefik routing rules that differ between modes (file-based for dev, Docker labels for deployment)
- **App Container**: Docker container built from user's Dockerfile, only created in deployment mode
- **Dockerfile**: Build instructions for user's application, provided by user (via `docker init` or manual creation), required for deployment mode

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developer can start development environment with `light up` in under 5 seconds (proxy only, no container builds) on a modern laptop with warm Docker daemon and cached Traefik image
- **SC-002**: Developer can start full deployment stack with `light up <environment>` for any non-development environment and have all services healthy within 60 seconds (assumes cached Docker images; first-time pulls excluded) including app container build and Supabase service startup
- **SC-003**: 100% of users running `light up` see correct guidance ("Start your app with npm run dev")
- **SC-004**: 100% of users running `light up <environment>` for non-development environments do NOT see development-workflow guidance
- **SC-005**: Zero port conflicts occur when switching between development and deployment modes (proper detection and user prompts)
- **SC-006**: Development mode provides instant feedback on code changes (hot-reload continues to work without containerization)
- **SC-007**: Deployment mode testing accurately reflects remote deployment (identical container configuration for any deployment target)
- **SC-008**: All existing Spec 001 functionality continues to work without regression
- **SC-009**: 100% of automated tests pass before merge (unit tests for mode detection, Dockerfile validation, compose file generation; contract tests for file output)
- **SC-010**: No TypeScript errors (`bun run typecheck`) and no linting errors (`bun run lint`)

## Assumptions

- Users have Docker Desktop installed and running (required for both modes)
- Users have Supabase CLI installed for development mode
- Users are responsible for providing a working Dockerfile for deployment mode (can use `docker init`, Nixpacks, or write custom)
- Users' Dockerfiles expose the application on the port configured in Lightstack (default: 3000)
- Let's Encrypt DNS challenge is configured with valid DNS provider credentials for deployment mode
- Users understand that development mode requires them to run their app separately, while deployment mode runs the app in a container
- Users can validate their Dockerfile locally with `docker build` before using deployment mode

## Dependencies

- Spec 001 implementation (core CLI commands, Docker Compose generation, Traefik proxy, environment management)
- Docker Compose with proper support for multiple compose files (base + environment-specific overrides)
- Docker CLI with `docker init` command (recommended for users creating Dockerfiles)
- mkcert for development mode SSL
- Let's Encrypt ACME client (Traefik built-in) for deployment mode SSL
- Supabase CLI for development mode and migrations
- User-provided Dockerfile for deployment mode (created via `docker init`, Nixpacks, or manually)

## Out of Scope

- Remote SSH deployment (deferred to future spec, related to issue #4)
- Zero-downtime deployments with blue-green strategy (deferred to issue #10)
- CI/CD workflow generation (deferred to issue #9)
- Database backup automation (deferred to issue #8)
- Dockerfile generation of any kind (users should use `docker init` or other battle-tested tools)
- Dockerfile validation beyond existence check (assumes user's Dockerfile is valid and tested locally)
- Multi-container app support (assumes single application container)
- Framework-specific Dockerfile optimization (user's responsibility)

## Clarifications

### Session 2025-10-12 (Revised)

- Q: Should Lightstack CLI generate Dockerfiles? → A: No. This violates Constitutional Principle #1 ("Don't Reinvent the Wheel"). Dockerfile generation is a complex problem already solved by battle-tested tools like `docker init`, Nixpacks, and Paketo Buildpacks. Supporting all frameworks, package managers, workspace configurations, and build patterns would create significant maintenance burden and still not match specialized tools. Users should use `docker init` (recommended) or provide their own Dockerfile. CLI's responsibility is to validate Dockerfile exists and provide helpful error messages pointing to `docker init`.
