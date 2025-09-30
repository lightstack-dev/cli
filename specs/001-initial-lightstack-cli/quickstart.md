# Lightstack CLI Quickstart Guide

**Goal**: Set up production-grade infrastructure for development, then deploy with identical patterns to production

## Prerequisites

Before starting, ensure you have:
- Docker Desktop installed and running (for the proxy container)
- Node.js 20+ installed
- [mkcert](https://github.com/FiloSottile/mkcert) installed (optional, for HTTPS)
- An existing web project (React, Vue, Nuxt, Next.js, etc.)

## Step 1: Install Lightstack CLI

```bash
npm install -g @lightstack-dev/cli
light --version
```

**Expected output**: Version number confirming installation

## Step 2: Initialize Proxy Configuration

```bash
# In your existing project directory
cd my-awesome-app
light init
```

**What happens**:
- Creates `light.config.yml` with proxy configuration
- Generates Traefik configuration for routing
- Sets up certificate directories

**Expected files created**:
```
my-awesome-app/
├── light.config.yml
└── .light/
    ├── docker-compose.yml      # Traefik proxy only
    ├── docker-compose.dev.yml  # Development overrides
    ├── traefik/               # Dynamic routing configs
    └── certs/                 # SSL certificates (created on first run)
```

## Step 3: Start Local Infrastructure

**Option A: Standard Mode** (proxy only):
```bash
light up
```

**What happens**:
- Validates Docker is running
- Starts Traefik proxy container
- Generates SSL certificates via mkcert
- Sets up routing to localhost services

**Option B: Self-Hosted Supabase Mode** (complete BaaS stack):
```bash
# First time: Initialize Supabase project
supabase init

# Start complete self-hosted stack
light up
```

**What happens**:
- Auto-detects Supabase project (supabase/ directory)
- Starts Traefik proxy + complete Supabase stack
- Deploys: PostgreSQL, Auth, API, Storage, Studio, Realtime
- Applies database migrations automatically
- Generates secure secrets

**Expected output**:
```
🚀 Starting local infrastructure...
✅ Local infrastructure started

Services running:
  ✓ https://app.lvh.me          → localhost:3000 (your app)
  ✓ https://api.lvh.me           → Supabase API
  ✓ https://studio.lvh.me        → Supabase Studio
  ✓ https://router.lvh.me        → Traefik dashboard

Start your app:
  npm run dev

Stop with: light down
```

## Step 4: Start Your App

In a separate terminal, start your app normally:

```bash
# Use your normal development command
npm run dev
# or: yarn dev, bun dev, pnpm dev, etc.
```

## Step 5: Access Your App via HTTPS

Open your browser and visit:

1. **https://app.lvh.me** - Your application
   - Should show your app running with valid SSL certificate
   - No more `localhost:3000` or port juggling!

2. **https://router.lvh.me** - Traefik Dashboard
   - Shows routing configuration
   - Service health status

**If using self-hosted Supabase**:
- **https://api.lvh.me** - Supabase API (complete self-hosted stack)
- **https://studio.lvh.me** - Supabase Studio (database management)

**Troubleshooting**:
- If lvh.me domains don't resolve, check your DNS settings (should work automatically)
- If SSL warnings appear, run `mkcert -install` manually
- If proxy fails to start, check `light logs` for details
- If containers keep restarting, check `light logs <service-name>` for specific errors

## Step 6: Develop Normally

1. Edit your application code as usual
2. Your app's hot reload still works perfectly
3. Access everything via nice HTTPS URLs
4. No containers slowing you down!

## Step 7: Test Production Stack Locally (Optional)

Before deploying to a remote server, test your production configuration locally:

```bash
# Add deployment target
light env add production \
  --host your-server.com \
  --domain yourdomain.com \
  --ssl-email you@example.com

# Test production stack locally (using local.lightstack.dev domain)
light up production
```

**What happens:**
- Deploys complete self-hosted Supabase stack locally
- Uses production configuration (persistent volumes, health checks)
- Generates secure secrets automatically
- Applies database migrations
- Accessible at: https://api.local.lightstack.dev, https://studio.local.lightstack.dev

**Why test locally:**
- Verify production configuration before remote deployment
- Debug container issues without touching production servers
- Validate migrations and seed data
- Test backup/restore procedures

## Step 8: Deploy to Production (Coming Soon)

```bash
# Deploy with identical infrastructure to remote server
light deploy production
```

**What will happen:**
- SSH to production server
- Git checkout (GitOps deployment)
- Same Supabase stack, production domain + Let's Encrypt SSL
- Zero-downtime deployment with health checks
- Automatic rollback on failure

**Result:** Your app is live with identical infrastructure patterns to development.

## Step 9: Stop Local Infrastructure (When Done)

```bash
light down
```

This stops only the local infrastructure. Your app development server keeps running normally.

## Common Commands

```bash
# Check proxy and service status
light status

# View proxy logs
light logs

# View logs from specific service
light logs traefik

# Stop proxy
light down

# Restart proxy
light down && light up

# Aliases
light start    # Same as "light up"
light stop     # Same as "light down"
light ps       # Same as "light status"
```

## Integration with Other Tools

Lightstack CLI handles infrastructure orchestration. Use all your existing tools normally:

```bash
# Your app development (unchanged)
npm run dev
yarn build
npm test

# Database migrations (using Supabase CLI)
supabase migration new add_users_table
supabase db push  # Applied automatically by light up production

# Git workflow (unchanged)
git add . && git commit -m "Add feature"
git push

# Lightstack orchestrates infrastructure
light up                    # Start local development stack
light up production         # Test production stack locally
light deploy production     # Deploy to remote server (coming soon)
```

## Validation Checklist

After completing this quickstart, you should have:

- ✅ Lightstack CLI installed and working
- ✅ Local infrastructure running (proxy or full self-hosted BaaS)
- ✅ Your app accessible via `https://app.lvh.me` with real SSL
- ✅ (Optional) Self-hosted Supabase stack with database migrations
- ✅ (Optional) Production stack tested locally via `light up production`
- ✅ Understanding of dev/prod parity workflow

## What Lightstack Does

**Complete self-hosted BaaS deployment platform:**
- ✅ Production-grade local development (HTTPS, reverse proxy, service routing)
- ✅ Self-hosted Supabase deployment (PostgreSQL, Auth, API, Storage, Studio)
- ✅ Automatic database migrations (integrates Supabase CLI)
- ✅ Local production testing (`light up production`)
- ✅ Identical infrastructure patterns from dev to production
- ✅ Dev/prod parity (same containers, same SSL, same routing)
- ✅ Infrastructure as code (readable Docker Compose configurations)

## What Lightstack Does NOT Do

**Focused scope - infrastructure orchestration only:**
- ❌ Replace your dev server (`npm run dev` stays the same)
- ❌ Replace Supabase CLI for migrations (we integrate it, not wrap it)
- ❌ Replace your deployment platform (works with any Docker-compatible server)
- ❌ Replace complex container orchestration (use Kubernetes for that)

## Getting Help

- `light --help` - General help
- `light [command] --help` - Command-specific help
- `light status` - Current proxy status
- Check proxy container: `docker ps`
- View proxy logs: `light logs`

---

**Success metrics**:
- **Development setup**: Complete Steps 1-6 in under 5 minutes and have production-grade local infrastructure
- **Production deployment**: Complete Step 7 and have identical infrastructure running in production