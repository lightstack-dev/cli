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
- Creates `light.config.yaml` with proxy configuration
- Generates Traefik configuration for routing
- Sets up certificate directories

**Expected files created**:
```
my-awesome-app/
├── light.config.yaml
└── .light/
    ├── docker-compose.yml      # Traefik proxy only
    ├── docker-compose.dev.yml  # Development overrides
    ├── traefik/               # Dynamic routing configs
    └── certs/                 # SSL certificates (created on first run)
```

## Step 3: Start the Proxy

```bash
light up
```

**What happens**:
- Validates Docker is running
- Starts Traefik proxy container only
- Generates SSL certificates via mkcert
- Sets up routing configuration

**Expected output**:
```
🚀 Starting local proxy...
✅ Proxy started

Ready to proxy:
  ✓ https://app.lvh.me          → localhost:3000
  ✓ https://router.lvh.me       → Traefik routing

Start your app:
  npm run dev
  yarn dev
  bun dev

Stop proxy with: light down
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

**With Supabase** (if you have it running):
```bash
# In another terminal
supabase start
```

Then visit:
- **https://api.lvh.me** - Supabase API
- **https://studio.lvh.me** - Supabase Studio

**Troubleshooting**:
- If lvh.me domains don't resolve, check your DNS settings (should work automatically)
- If SSL warnings appear, run `mkcert -install` manually
- If proxy fails to start, check `light logs` for details

## Step 6: Develop Normally

1. Edit your application code as usual
2. Your app's hot reload still works perfectly
3. Access everything via nice HTTPS URLs
4. No containers slowing you down!

## Step 7: Deploy to Production (Optional)

Now that you have production-grade patterns working locally, deploy with identical infrastructure:

```bash
# Configure production deployment target
# Edit light.config.yaml to add:
deployments:
  - name: production
    host: your-server.com
    domain: yourdomain.com
    ssl:
      enabled: true
      provider: letsencrypt
      email: you@example.com

# Deploy with identical infrastructure
light deploy production
```

**What happens:**
- Same Traefik configuration, different target (your server instead of localhost)
- Same SSL approach (Let's Encrypt instead of mkcert)
- Same routing patterns (functional subdomains on your domain)
- Same service discovery (Docker containers instead of localhost processes)

**Result:** Your app is live with identical infrastructure patterns to development.

## Step 8: Stop Local Infrastructure (When Done)

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

# BaaS services (unchanged)
supabase start
supabase db reset
firebase emulators:start

# Git workflow (unchanged)
git add . && git commit -m "Add feature"
git push

# Lightstack adds production-grade infrastructure
light up              # Start local infrastructure
light deploy prod     # Deploy with same infrastructure
```

## Validation Checklist

After completing this quickstart, you should have:

- ✅ Lightstack CLI installed and working
- ✅ Production-grade infrastructure running locally
- ✅ Your app accessible via `https://app.lvh.me` with real SSL
- ✅ Understanding of dev/prod parity workflow
- ✅ (Optional) Production deployment with identical infrastructure

## What Lightstack Does

**Development-to-production infrastructure orchestrator:**
- ✅ Production-grade local development (HTTPS, reverse proxy, service routing)
- ✅ Identical infrastructure patterns from dev to production
- ✅ Dev/prod parity (same SSL, same routing, same service discovery)
- ✅ Infrastructure as code (readable Docker Compose configurations)

## What Lightstack Does NOT Do

**Focused scope - infrastructure only:**
- ❌ Replace your dev server (`npm run dev` stays the same)
- ❌ Replace your deployment platform (works with any Docker-compatible server)
- ❌ Replace your BaaS tools (orchestrates them, doesn't wrap them)
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