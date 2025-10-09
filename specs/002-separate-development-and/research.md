# Research: Separate Development and Deployment Workflows

**Date**: 2025-10-09
**Feature**: Separate Development and Deployment Workflows
**Status**: Complete

## Overview

This document captures research findings for implementing clean separation between development and deployment modes in the Lightstack CLI. The research focuses on Dockerfile generation patterns, refactoring strategies for the `up.ts` command, and Docker Compose app service configuration.

## Research Areas

### 1. Dockerfile Generation for Node.js Applications

**Decision**: Use multi-stage Dockerfile with dependency caching and production optimization

**Rationale**:
- Multi-stage builds separate build dependencies from runtime, reducing image size
- Dependency layer caching speeds up rebuilds (only reinstall if package files change)
- Production stage runs as non-root user for security
- Standard pattern works for Next.js, Vite, Express, and most Node.js apps

**Pattern**:
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build (if needed for frameworks like Next.js)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/.next ./.next
# OR for non-framework apps:
# COPY --from=deps --chown=nodejs:nodejs /app .
USER nodejs
EXPOSE 3000
CMD ["node", "server.js"]
# OR: CMD ["npm", "start"]
```

**Alternatives Considered**:
- Single-stage Dockerfile: Simpler but larger images, no build optimization
- Buildpacks (pack/Paketo): Auto-detection but less control, extra dependency
- Custom per-framework templates: Too many templates to maintain

**Rejected Because**: Multi-stage is the Docker best practice, widely understood, and works across frameworks with minor tweaks. Users can customize the generated Dockerfile if needed.

---

### 2. Refactoring Strategy for `up.ts`

**Decision**: Extract mode detection early, branch to dedicated functions, share only common utilities

**Rationale**:
- Current `up.ts` has if-else scattered throughout (lines 60-88, 94-168, etc.)
- Early branching makes code paths independent and testable
- Reduces cognitive load (each function handles one mode completely)
- Follows Single Responsibility principle from constitution

**Pattern**:
```typescript
export async function upCommand(options: UpOptions = {}) {
  const env = options.env || 'development';
  const mode = determineMode(env); // 'development' | 'deployment'

  // Common setup (validate Docker, load config, check environment exists)
  await commonPrerequisiteChecks(env);

  // Branch early
  if (mode === 'development') {
    return await deployDevMode(options);
  } else {
    return await deployFullStackMode(env, options);
  }
}

async function deployDevMode(options: UpOptions) {
  // 1. Setup SSL (mkcert)
  // 2. Generate proxy configs (Traefik dynamic.yml)
  // 3. Start Traefik only
  // 4. Show dev-specific guidance ("Start your app with npm run dev")
}

async function deployFullStackMode(env: string, options: UpOptions) {
  // 1. Check Supabase CLI conflicts
  // 2. Generate Supabase stack + app container configs
  // 3. Build app Docker image
  // 4. Start full stack (Traefik + Supabase + app)
  // 5. Run migrations
  // 6. Show deployment-specific guidance (NO "start your app" message)
}
```

**Alternatives Considered**:
- Strategy pattern with classes: More OOP but overkill for two modes
- Keep single function with better if-else organization: Still mixes concerns
- Separate command files (`up-dev.ts`, `up-deploy.ts`): Splits related code too much

**Rejected Because**: Two functions in one file is simplest, keeps related code together, and avoids class ceremony. The CLI command interface stays the same (`light up [env]`).

---

### 3. Docker Compose App Service Definition

**Decision**: Add app service to `docker-compose.deployment.yml` with context build, Traefik labels, and volume mounts

**Rationale**:
- Deployment mode requires the app to be containerized
- Docker Compose build context points to user's project root
- Traefik labels for routing (Docker provider mode)
- Optional volume mounts for development-like workflows (rebuild without restart)

**Pattern**:
```yaml
services:
  app:
    build:
      context: ..
      dockerfile: Dockerfile
    container_name: ${PROJECT_NAME}-app
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - lightstack
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`app.${DOMAIN}`)"
      - "traefik.http.routers.app.tls=true"
      - "traefik.http.services.app.loadbalancer.server.port=3000"
    # Optional: volume mount for faster iteration in local deployment testing
    # volumes:
    #   - ../src:/app/src:ro
```

**Alternatives Considered**:
- External app container (user manages separately): Defeats purpose of deployment parity testing
- Include app in base `docker-compose.yml`: Would try to start in dev mode (wrong)
- Separate `docker-compose.app.yml` file: Extra file complexity for one service

**Rejected Because**: Adding app service to `deployment.yml` keeps it simple (only loads in non-dev environments) and maintains the two-file override pattern (base + environment-specific).

---

### 4. Mode Detection Logic

**Decision**: Simple environment name check: `'development'` → dev mode, everything else → deployment mode

**Rationale**:
- Explicit and unambiguous
- Matches existing environment configuration pattern from Spec 001
- Users already understand `light env add staging/production/qa`
- No magic or implicit rules

**Pattern**:
```typescript
function determineMode(env: string): 'development' | 'deployment' {
  return env === 'development' ? 'development' : 'deployment';
}
```

**Alternatives Considered**:
- Check for specific keywords (production, staging): Fragile, doesn't handle custom names (qa, demo, staging2)
- Configuration flag in `light.config.yml`: Extra configuration for simple rule
- Heuristics (check if Docker services are running): Non-deterministic, confusing

**Rejected Because**: Simplicity wins. The rule "development = dev mode, everything else = deployment mode" is easy to understand and implement.

---

### 5. Backward Compatibility with Spec 001

**Decision**: No backward compatibility needed (pre-release status)

**Rationale**:
- CLI has not been released yet (no users to break)
- Can rename `docker-compose.production.yml` → `docker-compose.deployment.yml` cleanly
- Can refactor `up.ts` without migration path
- Existing test projects can regenerate with `light init`

**Impact**: None - this is a breaking change in pre-release development

**Note**: If we were post-release, we would need:
1. Check for old `docker-compose.production.yml` → rename or warn
2. Migration guide for users
3. Deprecation notices

---

### 6. Testing Strategy

**Decision**: Test mode detection, file generation, and command building; mock Docker execution

**Rationale**:
- Follows Constitution Principle XIII: "Test What We Own"
- Mode detection is pure logic → unit test
- Dockerfile generation is string output → unit test
- Compose file generation is YAML output → contract test
- Docker execution is external → manual test only

**Test Coverage**:
```typescript
// Unit tests
describe('determineMode', () => {
  it('returns development for "development" env', () => {
    expect(determineMode('development')).toBe('development');
  });

  it('returns deployment for any other env', () => {
    expect(determineMode('production')).toBe('deployment');
    expect(determineMode('staging')).toBe('deployment');
    expect(determineMode('qa')).toBe('deployment');
  });
});

// Contract tests
describe('generateDockerfile', () => {
  it('outputs valid multi-stage Dockerfile', () => {
    const content = generateDockerfile({ framework: 'nextjs' });
    expect(content).toContain('FROM node:20-alpine AS deps');
    expect(content).toContain('USER nodejs');
    expect(content).toContain('EXPOSE 3000');
  });
});

// Integration tests (NOT E2E Docker tests)
describe('upCommand', () => {
  it('calls deployDevMode when env is development', async () => {
    const spy = vi.spyOn(upModule, 'deployDevMode');
    await upCommand({ env: 'development' });
    expect(spy).toHaveBeenCalled();
  });
});
```

**Alternatives Considered**:
- E2E tests that actually run Docker: Slow, flaky, tests Docker not our code
- No tests: Risky for refactoring, violates Constitution Principle XII

**Rejected Because**: Unit/contract tests give us confidence without the overhead and flakiness of Docker E2E tests.

---

## Summary of Decisions

| Area | Decision | Key Benefit |
|------|----------|-------------|
| Dockerfile | Multi-stage Node.js template | Industry standard, optimized builds |
| Refactoring | Early branch to dedicated functions | Clear separation, testable |
| App Service | Include in deployment.yml with Traefik labels | Single-file simplicity, proper routing |
| Mode Detection | Explicit env name check | Simple, unambiguous |
| Backward Compat | Not needed (pre-release) | Clean break, no migration burden |
| Testing | Unit + contract, no E2E | Fast, reliable, tests our code |

## Open Questions

None - all technical decisions resolved for implementation.

## References

- Spec 001: `specs/001-initial-lightstack-cli/`
- Current implementation: `src/commands/up.ts`
- Docker multi-stage build docs: https://docs.docker.com/build/building/multi-stage/
- Node.js Docker best practices: https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
- Constitution: `.specify/memory/constitution.md`
