# Deployment Flow: Technical Design

**Version**: 1.0.0
**Date**: 2025-10-02
**Status**: Design Document

## Overview

This document describes the complete technical flow for deploying Supabase-backed applications using Lightstack CLI, from initial setup through production deployment.

## Core Principles

1. **Perfect Dev/Prod Parity**: Same Docker Compose files run locally and remotely
2. **PII Protection**: No personally identifiable information in git (ACME email in `~/.lightstack/config.yml`)
3. **Secret Isolation**: Local and remote environments have separate `.env` files (never copied)
4. **GitOps Deployment**: Deploy via git tags, not file transfer

## Phase 1: Initial Setup

### Developer Machine Setup (One-Time)

```bash
light init my-app
```

**What happens:**
1. Prompt for ACME email (for Let's Encrypt SSL)
   - Saves to `~/.lightstack/config.yml` (user config, NOT project)
   - Used across all projects on this machine

2. Generate project files:
   - `light.config.yml` (project config, NO secrets/PII)
   - `Dockerfile` (production build instructions)
   - `.light/docker-compose.yml` (base Traefik configuration)
   - `.light/docker-compose.development.yml` (dev overrides: mkcert, file provider)
   - `.light/docker-compose.production.yml` (prod overrides: full Supabase stack, app container, Let's Encrypt)

3. Install mkcert and generate local SSL certificates

**Files created:**
```
~/.lightstack/
└── config.yml                    # email: dev@example.com (PII)

project-root/
├── light.config.yml              # Project config (NO secrets)
├── Dockerfile                    # App build instructions
└── .light/
    ├── docker-compose.yml
    ├── docker-compose.development.yml
    ├── docker-compose.production.yml
    └── certs/                    # mkcert certificates
```

## Phase 2: Local Development

```bash
supabase init
light up              # Defaults to 'development'
npm run dev
```

**What happens:**
1. Reads: `docker-compose.yml` + `docker-compose.development.yml`
2. Starts:
   - Traefik proxy (with mkcert SSL)
   - Proxies to `localhost:3000` (your dev server)
   - Proxies to Supabase CLI (if `supabase/` exists)

**URLs:**
- `https://app.lvh.me` → localhost:3000 (Vite/Next dev server)
- `https://api.lvh.me` → Supabase CLI API
- `https://studio.lvh.me` → Supabase CLI Studio

**No secrets needed** - Supabase CLI manages its own.

## Phase 3: Configure Production Target

```bash
light env add production
```

**Interactive prompts:**
```
Domain (public domain): myapp.com
SSH host [myapp.com]:              # Defaults to domain
SSH user [ubuntu]:
SSH port [22]:
Enable SSL [Y/n]: y
SSL provider [letsencrypt]:
DNS provider (for Let's Encrypt): cloudflare
DNS API key: ********************
```

**What gets saved where:**

| Data | Location | Reason |
|------|----------|--------|
| Domain, host, user, port, dns_provider | `light.config.yml` | Config (not secret) |
| DNS_API_KEY | `.env` | Secret (gitignored) |
| ACME_EMAIL | Already in `~/.lightstack/config.yml` | PII (not in project) |

**Result:**
```yaml
# light.config.yml (committed to git)
deployments:
  - name: production
    domain: myapp.com
    host: myapp.com
    user: ubuntu
    port: 22
    ssl:
      provider: letsencrypt
      dns_provider: cloudflare
```

```bash
# .env (gitignored)
DNS_API_KEY=xyz123abc456def789
```

## Phase 4: Local Production Testing

```bash
light up production
```

**Prerequisites check:**
1. Is 'production' configured? → If not, run `light env add production`
2. Does `.env` have `DNS_API_KEY`? → If not, prompt for it
3. Does `~/.lightstack/config.yml` have email? → Should exist from init

**What happens:**
1. Check if Supabase CLI running → If yes, prompt to stop
2. Read Docker Compose files: `base + production`
3. Set environment variables:
   ```bash
   DOMAIN=local.lightstack.dev
   DNS_PROVIDER=cloudflare
   DNS_API_KEY=<from .env>
   ACME_EMAIL=<from ~/.lightstack/config.yml>
   ```
4. Start complete production stack:
   - PostgreSQL container
   - All 8 Supabase services
   - Build and run app container (from Dockerfile)
   - Traefik with Let's Encrypt DNS challenge
5. Let's Encrypt validates via DNS → Issues **real certificate** for `*.local.lightstack.dev`
6. Apply Supabase migrations

**URLs (local production):**
- `https://app.local.lightstack.dev` → Containerized app (production build)
- `https://api.local.lightstack.dev` → Supabase API (self-hosted)
- `https://studio.local.lightstack.dev` → Supabase Studio

**This is IDENTICAL to production** except domain name.

## Phase 5: Deploy to Production

```bash
git tag v1.0.0
git push --tags
light deploy production --tag v1.0.0
```

**Prerequisites check:**
1. Is 'production' configured? → If not, run `light env add production`
2. **Confirmation prompt**: "Deploy to production? [y/N]"

**What happens on local machine:**
1. Validate SSH access to server
2. SSH to server: `ssh ubuntu@myapp.com`

**What happens on remote server:**

### First Deployment (no code on server yet)
```bash
# On server (automated by CLI):
git clone https://github.com/user/my-app.git /opt/my-app
cd /opt/my-app
git checkout v1.0.0

# Check for .env
if [ ! -f .env ]; then
  # Prompt developer for secrets (interactive)
  echo "DNS_API_KEY (for Let's Encrypt): "
  read dns_key
  echo "DNS_API_KEY=$dns_key" >> .env

  # Generate Supabase production secrets
  echo "POSTGRES_PASSWORD=$(generate_secret)" >> .env
  echo "JWT_SECRET=$(generate_secret)" >> .env
  # ... etc
fi

# Set domain for this deployment
export DOMAIN=myapp.com

# Get ACME email from local machine's ~/.lightstack/config.yml
export ACME_EMAIL=<transferred from local config>

# Start production stack (SAME command as local testing!)
docker compose -f .light/docker-compose.yml \
               -f .light/docker-compose.production.yml \
               --env-file .env \
               up -d

# Apply migrations
supabase db push --db-url "postgresql://postgres:$POSTGRES_PASSWORD@localhost:5432/postgres"
```

### Subsequent Deployments
```bash
# On server:
cd /opt/my-app
git fetch --tags
git checkout v1.1.0

# .env already exists from first deploy
# Just restart with new code
docker compose -f .light/docker-compose.yml \
               -f .light/docker-compose.production.yml \
               --env-file .env \
               up -d --build

# Apply new migrations if any
supabase db push
```

**URLs (production):**
- `https://myapp.com` → Containerized app
- `https://api.myapp.com` → Supabase API
- `https://studio.myapp.com` → Supabase Studio

## Key Technical Details

### Docker Compose Strategy

**Base file** (`docker-compose.yml`):
- Traefik router base configuration
- Network definitions
- Common service configs

**Development override** (`docker-compose.development.yml`):
- File provider (for Traefik dynamic routes)
- mkcert certificate mounting
- Proxy to localhost services (not containerized)

**Production override** (`docker-compose.production.yml`):
- Complete Supabase stack (10+ services)
- App container with build instructions
- Docker provider (for Traefik labels)
- Let's Encrypt DNS challenge configuration
- Persistent volumes for PostgreSQL

### Environment Variables Flow

```
┌─────────────────────────────────────────────────────────┐
│ ACME_EMAIL                                              │
│ Source: ~/.lightstack/config.yml                        │
│ Set once during: light init                             │
│ Used by: light up production, light deploy production   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DNS_API_KEY                                             │
│ Source: .env (local) or .env (remote)                   │
│ Set during: light env add production                    │
│ Prompted again if missing during: light up production   │
│ Prompted for remote during: light deploy (first time)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DOMAIN                                                  │
│ Source: Deployment config (light.config.yml)            │
│ Local: local.lightstack.dev (hardcoded)                 │
│ Remote: From deployment config (e.g., myapp.com)        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Supabase Secrets (POSTGRES_PASSWORD, JWT_SECRET, etc.)  │
│ Source: .env (local) or .env (remote)                   │
│ Local: Generated on first light up production           │
│ Remote: Generated on first light deploy                 │
│ Never copied between environments                       │
└─────────────────────────────────────────────────────────┘
```

### Security Model

**What's in Git (committed):**
- ✅ `light.config.yml` (domains, hosts, dns_provider)
- ✅ `Dockerfile` (build instructions)
- ✅ Docker Compose files (infrastructure templates)
- ✅ Supabase migrations (schema changes)

**What's NOT in Git (gitignored):**
- ❌ `.env` (secrets: DNS_API_KEY, POSTGRES_PASSWORD, etc.)
- ❌ `~/.lightstack/config.yml` (PII: ACME_EMAIL)
- ❌ `.light/certs/` (mkcert certificates)
- ❌ `.light/volumes/` (database data)

**Secret Isolation:**
- Local `.env` has secrets for local testing
- Remote `.env` has secrets for production
- **No automatic copying** - CLI prompts for secrets when needed
- Each environment is self-contained

## Error Handling

### Missing Configuration
```bash
light up production
→ Environment 'production' not configured
→ Automatically runs: light env add production
→ Collects all required information
→ Then proceeds with light up production
```

### Missing Secrets
```bash
light up production
→ .env missing DNS_API_KEY
→ Prompt: "DNS API key (for Let's Encrypt): "
→ Save to .env
→ Continue with deployment
```

### Production Safeguard
```bash
light deploy production
→ Confirmation: "Deploy to production? [y/N]"
→ User must explicitly confirm
→ Prevents accidental deployments
```

## Future Enhancements

- [ ] Support for multiple DNS providers (currently manual)
- [ ] Automated rollback on health check failure
- [ ] Zero-downtime deployments (blue-green)
- [ ] CI/CD integration (GitHub Actions templates)
- [ ] Database backup automation
- [ ] Multi-server deployments (load balancing)

---

This design provides a complete, secure, and developer-friendly deployment workflow from local development to production.
