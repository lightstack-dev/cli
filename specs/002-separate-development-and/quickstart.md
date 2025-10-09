# Quickstart: Testing Development and Deployment Modes

**Feature**: Separate Development and Deployment Workflows
**Date**: 2025-10-09
**Audience**: Developers implementing and testing Spec 002

## Overview

This guide demonstrates how to test both development and deployment modes after implementing the workflow separation. Use this to validate that the refactoring works correctly before merging.

---

## Prerequisites

- Docker Desktop running
- Supabase CLI installed (`npm install -g supabase`)
- A test Next.js/Vite app (or any Node.js app)
- Lightstack CLI built from this branch (`bun run build`)

---

## Test Scenario 1: Development Mode (Proxy Only)

**Goal**: Verify that `light up` starts only Traefik and proxies to localhost services.

### Steps

1. **Initialize test project**:
   ```bash
   cd /path/to/test-nextjs-app
   supabase init
   light init
   ```

2. **Start Supabase CLI** (separate terminal):
   ```bash
   supabase start
   ```
   Wait for "Started supabase local development setup" message.

3. **Start Lightstack development mode**:
   ```bash
   light up
   # Or explicitly: light up development
   ```

4. **Verify outputs**:
   - Console shows: "Start your app: npm run dev"
   - Console shows: ✓ https://app.lvh.me → Your application
   - Console shows: ✓ https://api.lvh.me → Supabase API
   - Console shows: ✓ https://studio.lvh.me → Supabase Studio

5. **Check running containers**:
   ```bash
   docker ps --format "{{.Names}}"
   ```
   **Expected**: Only `myproject-router` (Traefik)
   **NOT expected**: Any Supabase containers (supabase_db, supabase_kong, etc.)

6. **Start your app** (separate terminal):
   ```bash
   npm run dev
   ```

7. **Test routing**:
   - Visit `https://app.lvh.me` → Should show your app
   - Visit `https://api.lvh.me` → Should show Supabase API response
   - Visit `https://studio.lvh.me` → Should show Supabase Studio UI
   - Visit `https://router.lvh.me` → Should show Traefik dashboard

8. **Test hot-reload**:
   - Edit a file in your app
   - **Expected**: Changes reflect immediately (hot-reload working)

### Success Criteria

✅ Only Traefik container running (no Supabase containers, no app container)
✅ HTTPS routing works to localhost services
✅ Console output includes "Start your app: npm run dev"
✅ Hot-reload works (app not containerized)
✅ Startup time < 5 seconds

---

## Test Scenario 2: Deployment Mode (Full Stack)

**Goal**: Verify that `light up <env>` starts full containerized stack including app.

### Steps

1. **Stop development mode** (if running):
   ```bash
   light down
   supabase stop
   ```

2. **Configure a deployment environment**:
   ```bash
   light env add staging
   ```
   When prompted:
   - Domain: `local.lightstack.dev` (for local testing)
   - SSH host: (press Enter to skip for local testing)
   - Enable SSL: `y`
   - SSL provider: `letsencrypt`
   - DNS provider: `cloudflare`
   - DNS API key: (enter your Cloudflare API key)

3. **Verify Dockerfile was generated**:
   ```bash
   cat Dockerfile
   ```
   **Expected**: Multi-stage Node.js Dockerfile

4. **Start Lightstack deployment mode**:
   ```bash
   light up staging
   ```

5. **Verify outputs**:
   - Console shows: "Setting up production Supabase stack..."
   - Console shows: "Applying database migrations..."
   - Console shows: ✓ https://app.local.lightstack.dev → Your application (containerized)
   - Console does NOT show: "Start your app: npm run dev"

6. **Check running containers**:
   ```bash
   docker ps --format "{{.Names}}" | sort
   ```
   **Expected** (approximately):
   ```
   myproject-analytics
   myproject-app           ← App container (NEW!)
   myproject-auth
   myproject-db
   myproject-kong
   myproject-meta
   myproject-realtime
   myproject-rest
   myproject-router
   myproject-storage
   myproject-studio
   myproject-vector
   ```

7. **Test containerized app**:
   - Visit `https://app.local.lightstack.dev`
   - **Expected**: Your app loads (from Docker container, not localhost)
   - **Expected**: Production build (not dev server with hot-reload)

8. **Test Supabase services**:
   - Visit `https://api.local.lightstack.dev` → Supabase Kong API
   - Visit `https://studio.local.lightstack.dev` → Supabase Studio

9. **Verify app container logs**:
   ```bash
   docker logs myproject-app
   ```
   **Expected**: App startup logs (npm start or node server.js)

10. **Test rebuild** (optional):
    ```bash
    light down
    # Make a change to your app code
    light up staging
    ```
    **Expected**: Docker rebuilds app image, change is visible

### Success Criteria

✅ Full Supabase stack running (~10 containers)
✅ App container built and running from Dockerfile
✅ HTTPS routing works to containerized services
✅ Console output does NOT include "Start your app" message
✅ App serves production build (not dev server)
✅ Database migrations applied successfully
✅ Startup time < 60 seconds

---

## Test Scenario 3: Port Conflict Detection

**Goal**: Verify that CLI detects Supabase CLI conflicts before starting deployment mode.

### Steps

1. **Start Supabase CLI** (separate terminal):
   ```bash
   supabase start
   ```

2. **Try to start deployment mode**:
   ```bash
   light up staging
   ```

3. **Verify prompt**:
   - Console shows: "Supabase development environment is running"
   - Console shows: "This conflicts with the production stack (ports, containers)"
   - Console prompts: "Stop development environment and start production stack? (Y/n)"

4. **Answer 'y'**:
   - **Expected**: CLI runs `supabase stop`
   - **Expected**: CLI starts deployment stack
   - **Expected**: No port 5432 conflicts

### Success Criteria

✅ CLI detects Supabase CLI running
✅ User is prompted to stop before proceeding
✅ If user confirms, Supabase CLI is stopped automatically
✅ Deployment stack starts successfully after cleanup

---

## Test Scenario 4: Dockerfile Validation

**Goal**: Verify that deployment mode fails gracefully if Dockerfile is missing.

### Steps

1. **Remove Dockerfile** (temporarily):
   ```bash
   mv Dockerfile Dockerfile.bak
   ```

2. **Try to start deployment mode**:
   ```bash
   light up staging
   ```

3. **Verify error message**:
   ```
   ❌ Error: Dockerfile not found

   Cause: Deployment mode requires a Dockerfile to build your app container
   Solution: Run 'light init' to generate a default Dockerfile, or create your own

   For more help: light up --help
   ```

4. **Restore Dockerfile**:
   ```bash
   mv Dockerfile.bak Dockerfile
   ```

### Success Criteria

✅ CLI validates Dockerfile existence before attempting build
✅ Error message is clear and actionable
✅ Provides recovery steps

---

## Test Scenario 5: Mode-Appropriate Guidance

**Goal**: Verify that user guidance changes based on mode.

### Setup

Create a simple script to extract "Next steps" section from output:

```bash
#!/bin/bash
# test-guidance.sh
echo "=== DEVELOPMENT MODE ==="
light up 2>&1 | grep -A 5 "Next steps:"

light down

echo ""
echo "=== DEPLOYMENT MODE ==="
light up staging 2>&1 | grep -A 5 "Next steps:"
```

### Expected Output

**Development Mode**:
```
Next steps:
  Start your app: npm run dev

Manage Lightstack infrastructure:
  Restart: light restart
  Stop:    light down
```

**Deployment Mode**:
```
Manage Lightstack infrastructure:
  Restart: light restart
  Stop:    light down

Manage deployments:
  Add deployment target: light env add <name>
```

### Success Criteria

✅ Development mode includes "Start your app" message
✅ Deployment mode does NOT include "Start your app" message
✅ Guidance is contextually appropriate

---

## Cleanup After Testing

```bash
# Stop all containers
light down

# Clean up test data
rm -rf .light/
rm Dockerfile

# Stop Supabase CLI if running
supabase stop

# Remove test environment config (optional)
# Edit light.config.yml and remove staging environment
```

---

## Troubleshooting

### "Docker is not running"
**Solution**: Start Docker Desktop

### "mkcert: command not found"
**Expected**: CLI warns but continues without SSL in development mode

### Port 3000 already in use
**Solution**: Stop the app using port 3000, or change `PORT` in config

### "Permission denied" during Docker build
**Solution**: Ensure Dockerfile has correct permissions and context

### Containers start but app is unreachable
**Check**:
1. `docker logs myproject-app` for errors
2. Traefik logs: `docker logs myproject-router`
3. Traefik dashboard: https://router.lvh.me (dev) or check deployment domain

---

## Performance Benchmarks

Test on a mid-range laptop (for reference):

| Operation | Target | Actual (measure yours) |
|-----------|--------|------------------------|
| `light up` (development) | <5s | ___ seconds |
| `light up staging` (first build) | <60s | ___ seconds |
| `light up staging` (cached build) | <30s | ___ seconds |
| `light down` | <5s | ___ seconds |

---

## Next Steps

After validating all scenarios:

1. Run test suite: `bun test`
2. Run type check: `bun run typecheck`
3. Run linter: `bun run lint`
4. Create PR with test results in description
5. Tag for review

---

## Questions or Issues?

If you encounter behavior that doesn't match this guide:

1. Check `src/commands/up.ts:deployDevMode()` and `deployFullStackMode()` implementations
2. Verify mode detection in `determineMode(env)` function
3. Check Docker Compose file generation (dev vs deployment)
4. Review Dockerfile generation logic
5. Open issue with reproduction steps
