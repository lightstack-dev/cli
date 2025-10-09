# Lightstack CLI Quickstart Guide

**Goal**: Set up production-grade infrastructure for development, then deploy with identical patterns to production

## Prerequisites

Before starting, ensure you have:
- Docker Desktop installed and running (for the Supabase containers)
- Node.js 20+ installed
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (required)
- [mkcert](https://github.com/FiloSottile/mkcert) installed (optional, for HTTPS)
- An existing web project (React, Vue, Nuxt, Next.js, etc.)

## Step 1: Install Lightstack CLI

```bash
npm install -g @lightstack-dev/cli
light --version
```

**Expected output**: Version number confirming installation

## Step 2: Initialize Project Configuration

```bash
# In your existing project directory
cd my-awesome-app
light init
```

**Interactive prompts**:
- Project name (defaults to directory name)
- ACME email (for Let's Encrypt SSL certificates)
  - Stored in `~/.lightstack/config.yml` (user config, NOT in project)
  - Used across all your projects

**What happens**:
- Creates `light.config.yml` with project configuration (NO secrets/PII)
- Generates Dockerfile for production builds
- Generates Docker Compose files (base, development, production)
- Installs mkcert and generates local SSL certificates
- Saves ACME email to user config (not committed to git)

**Expected files created**:
```
~/.lightstack/
└── config.yml                          # ACME email (PII, not in project)

my-awesome-app/
├── light.config.yml                    # Project config (NO secrets)
├── Dockerfile                          # Production build instructions
└── .light/
    ├── docker-compose.yml              # Base Traefik configuration
    ├── docker-compose.development.yml  # Dev overrides (mkcert, proxies)
    ├── docker-compose.production.yml   # Prod overrides (full stack)
    ├── traefik/                        # Dynamic routing configs
    └── certs/                          # SSL certificates
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

**Option B: Self-Hosted Supabase Mode** (complete stack - RECOMMENDED):
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

**Note**: This is the primary use case for Lightstack - deploying your own Supabase instance

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

## Step 7: Configure Production Target

Add your production deployment target:

```bash
light env add production
```

**Interactive prompts**:
- Domain (public domain): `yourdomain.com`
- SSH host (defaults to domain): `yourdomain.com`
- SSH user: `ubuntu`
- SSH port: `22`
- Enable SSL: `Yes`
- SSL provider: `letsencrypt`
- DNS provider (for Let's Encrypt): `cloudflare` (or route53, etc.)
- DNS API key: `******************`

**What gets saved where**:
- Domain, host, user, port, DNS provider → `light.config.yml` (committed)
- DNS API key → `.env` (gitignored)
- ACME email → Already in `~/.lightstack/config.yml` from Step 2

## Step 8: Test Production Stack Locally

Before deploying to remote server, test the complete production stack on your laptop:

```bash
light up production
```

**What happens**:
1. Checks if Supabase CLI is running → Prompts to stop if needed
2. Reads production configuration from `docker-compose.production.yml`
3. Builds your app using Dockerfile
4. Starts complete production stack locally:
   - PostgreSQL container (not Supabase CLI)
   - All 8 Supabase services (containerized)
   - Your containerized app (production build)
   - Traefik with Let's Encrypt DNS challenge
5. Let's Encrypt validates via DNS → Issues **real certificate** for `*.local.lightstack.dev`
6. Applies database migrations

**Access your local production stack**:
- `https://app.local.lightstack.dev` → Your containerized app (production build)
- `https://api.local.lightstack.dev` → Supabase API (self-hosted)
- `https://studio.local.lightstack.dev` → Supabase Studio

**This is IDENTICAL to production**, just different domain.

**Why test locally**:
- Verify production configuration before remote deployment
- Debug container issues without touching production servers
- Validate migrations and Dockerfile builds
- Test with real Let's Encrypt certificates

## Step 9: Deploy to Production

Tag your release and deploy:

```bash
git tag v1.0.0
git push --tags
light deploy production --tag v1.0.0
```

**Safety prompt**:
```
Deploy to production? [y/N]
```
You must explicitly confirm.

**What happens on first deploy**:
1. SSH to production server
2. Clone repository to `/opt/my-awesome-app`
3. Checkout git tag `v1.0.0`
4. Check for `.env` on server
5. If missing → Prompt for DNS_API_KEY and generate production secrets
6. Save all secrets to server's `.env` (never copied from local)
7. Run: `docker compose -f .light/docker-compose.yml -f .light/docker-compose.production.yml up -d`
8. Apply database migrations
9. Health checks

**What happens on subsequent deploys**:
1. SSH to server
2. `git fetch && git checkout v1.1.0`
3. `.env` already exists (from first deploy)
4. Rebuild and restart containers
5. Apply new migrations

**Access your production app**:
- `https://yourdomain.com` → Your app
- `https://api.yourdomain.com` → Supabase API
- `https://studio.yourdomain.com` → Supabase Studio

**Result:** Identical infrastructure from local development to production.

## Step 10: Stop Local Infrastructure (When Done)

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

**Complete self-hosted Supabase deployment platform:**
- ✅ Production-grade local development (HTTPS, reverse proxy, service routing)
- ✅ Self-hosted Supabase deployment (PostgreSQL, Auth, API, Storage, Studio)
- ✅ Automatic database migrations (integrates Supabase CLI)
- ✅ Local production testing (`light up production`)
- ✅ Identical infrastructure patterns from dev to production
- ✅ Dev/prod parity (same containers, same SSL, same routing)
- ✅ Infrastructure as code (readable Docker Compose configurations)
- ✅ Cost savings ($25-$2900/month hosted Supabase → $20-200/month self-hosted)

## What Lightstack Does NOT Do

**Focused scope - Supabase infrastructure orchestration only:**
- ❌ Replace your dev server (`npm run dev` stays the same)
- ❌ Replace Supabase CLI for migrations (we integrate it, not wrap it)
- ❌ Replace your deployment platform (works with any Docker-compatible server)
- ❌ Support other BaaS platforms yet (Supabase-only for now - YAGNI)
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