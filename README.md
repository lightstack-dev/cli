![Lightstack logo](https://raw.githubusercontent.com/lightstack-dev/.github/refs/heads/main/assets/lighstack-logo-2025-08-protected.svg)

# Lightstack CLI

> Bridge localhost and production with identical infrastructure patterns

[![npm version](https://img.shields.io/npm/v/@lightstack-dev/cli.svg)](https://www.npmjs.com/package/@lightstack-dev/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Complete self-hosted BaaS deployment platform.** Lightstack CLI gives you production-grade infrastructure in development (HTTPS, reverse proxy, full BaaS stack), then deploys the identical environment to production. Perfect dev/prod parity with complete control over your data and infrastructure.

## ✨ Features

### Development Experience
- 🔒 **Production-grade HTTPS** - Real SSL certificates in development
- 🌐 **Clean URLs** - `https://app.lvh.me` instead of `localhost:3000`
- 🗃️ **Self-hosted BaaS** - Complete Supabase stack running locally
- 🚀 **Zero disruption** - Keep your existing `npm run dev` workflow

### Production Deployment
- 🌍 **Identical infrastructure** - Same containers, same config, different domain
- 🗃️ **Self-hosted BaaS in production** - Deploy complete Supabase stack to your servers
- 📦 **GitOps deployment** - Deploy via git tags with zero-downtime
- 🔐 **Let's Encrypt SSL** - Automatic HTTPS certificates in production

### Cost & Control Benefits
- 💰 **Escape vendor lock-in** - Self-host instead of paying hosted BaaS fees
- 🔐 **Complete data control** - Your database, your servers, your rules
- 📈 **Scale without surprises** - Predictable costs as you grow
- 🛠️ **Full customization** - Modify and extend your BaaS stack as needed

## 🚀 Quick Start

### Local Development
```bash
# Install globally
npm install -g @lightstack-dev/cli

# In your existing project
light init

# Start production-grade local environment
light up

# Start your app normally (separate terminal)
npm run dev

# Access via HTTPS: https://app.lvh.me
```

### Production Deployment
```bash
# Configure deployment target
light init --production

# Deploy with identical infrastructure
light deploy production

# Your app is live with same URLs, same SSL, same routing
```

## 📋 Requirements

### Development
- Node.js 20+
- Docker Desktop (for local infrastructure)
- [mkcert](https://github.com/FiloSottile/mkcert) (auto-installed, for local HTTPS)
- [Supabase CLI](https://supabase.com/docs/guides/local-development) (if using self-hosted Supabase)

### Production
- Docker-compatible VPS or cloud server
- Domain name for your application
- [Supabase CLI](https://supabase.com/docs/guides/local-development) (for database migrations)

## 🤔 Why Self-Host Your BaaS?

**Cost Savings at Scale:**
- Supabase hosted: $25/month → $2,900/month as you grow
- Self-hosted: $20-200/month predictable server costs
- **Save thousands** while keeping the same functionality

**Complete Control:**
- **Data sovereignty** - Your PostgreSQL database on your servers
- **Custom modifications** - Extend Supabase services as needed
- **Compliance ready** - GDPR, HIPAA, SOC2 on your infrastructure
- **No vendor lock-in** - Switch hosting providers anytime

**Production Grade:**
- **Battle-tested stack** - Same containers Supabase uses internally
- **Automated SSL** - Let's Encrypt certificates managed by Traefik
- **Zero-downtime deployments** - GitOps with health checks and rollbacks
- **Monitoring ready** - Standard Docker monitoring and logging

## 🛠️ Installation

### Global Installation (Recommended)

```bash
npm install -g @lightstack-dev/cli
```

### Per-Project Installation

```bash
npm install --save-dev @lightstack-dev/cli
npx light init
```

## 📖 Usage

### Initialize Project

```bash
light init
```

This creates:
- `light.config.yaml` - Project configuration
- `.light/` directory with Docker infrastructure

### Development Workflow

**Standard Development** (proxies to localhost):
```bash
# 1. Start the local infrastructure
light up

# 2. Start your app normally (separate terminal)
npm run dev

# 3. Access via HTTPS:
# https://app.lvh.me → your app
# https://router.lvh.me → routing dashboard
```

**Self-Hosted BaaS Development** (complete Supabase stack):
```bash
# 1. Initialize Supabase project (first time only)
supabase init

# 2. Start Lightstack infrastructure
light up

# 3. Start your app
npm run dev

# 4. Access everything via HTTPS:
# https://app.lvh.me → your app (proxied to localhost:3000)
# https://api.lvh.me → self-hosted Supabase API
# https://studio.lvh.me → self-hosted Supabase Studio
```

### Production Deployment

**Deploy Self-Hosted Supabase Stack:**
```bash
# 1. Create deployment target
light env add production \
  --host your-server.com \
  --domain yourdomain.com \
  --ssl-email your@email.com

# 2. Test production stack locally (optional but recommended)
light up production
# Access at: https://api.local.lightstack.dev, https://studio.local.lightstack.dev

# 3. Deploy to production server (coming soon)
light deploy production
```

**What gets deployed:**
- Complete self-hosted Supabase stack (PostgreSQL, Auth, API, Storage, Studio)
- Your application containers
- Traefik reverse proxy with Let's Encrypt SSL
- Database migrations applied automatically
- Persistent volumes for data storage

### Other Commands

```bash
# Infrastructure management
light down             # Stop local infrastructure
light down production  # Stop production stack (local testing)
light status           # Show infrastructure and service status
light logs             # View all logs
light logs traefik     # View specific service logs

# Environment management
light env list         # List all deployment targets
light env add <name>   # Add deployment target
light env remove <name> # Remove deployment target

# Utility commands
light --help           # Show all available commands
light --version        # Show CLI version

# Aliases
light start            # Same as "light up"
light stop             # Same as "light down"
light ps               # Same as "light status"
```

## 🔧 Configuration

### Project Configuration

`light.config.yaml`
```yaml
name: my-project
services:
  - name: app         # Creates https://app.lvh.me
    type: nuxt
    port: 3000
  - name: admin       # Creates https://admin.lvh.me
    type: react
    port: 4000

# Optional: Deployment targets
environments:
  production:
    host: your-server.com
    domain: yourdomain.com
    ssl_email: your@email.com
  staging:
    host: staging-server.com
    domain: staging.yourdomain.com
    ssl_email: your@email.com
```

### Domain Configuration (Optional)

```yaml
name: my-project
domain: lvh.me        # Default for development
services:
  - name: app
    port: 3000
    # Results in: https://app.{domain}
```

### Environment Variables

Generated automatically in `.light/.env.supabase` for production deployments:
```bash
# Supabase secrets (auto-generated)
POSTGRES_PASSWORD=...
JWT_SECRET=...
ANON_KEY=...
SERVICE_KEY=...

# SMTP configuration (you provide)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
```

## 🏗️ Architecture

**Complete self-hosted BaaS stack with identical dev/prod infrastructure:**

### Local Development (Standard Mode)
```
┌─ Docker Network ────────────────────────────────────────┐
│                                                         │
│  Traefik (HTTPS proxy)                                 │
│    ↓ https://app.lvh.me                                │
│  Your App (localhost:3000)                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Local Development (Self-Hosted BaaS)
```
┌─ Docker Network ────────────────────────────────────────┐
│                                                         │
│  Traefik (HTTPS proxy) ─────────────────────────────┐  │
│    ├─ https://app.lvh.me → localhost:3000           │  │
│    ├─ https://api.lvh.me → Kong API Gateway         │  │
│    └─ https://studio.lvh.me → Supabase Studio       │  │
│                                                      │  │
│  Complete Self-Hosted Supabase Stack:                │  │
│    ├─ PostgreSQL (persistent data)                   │  │
│    ├─ Kong API Gateway (routing)                     │  │
│    ├─ GoTrue (authentication)                        │  │
│    ├─ PostgREST (database API)                       │  │
│    ├─ Realtime (subscriptions)                       │  │
│    ├─ Storage (file management)                      │  │
│    ├─ Studio (admin UI)                              │  │
│    └─ Postgres Meta (schema management)              │  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Production Deployment (Identical Stack)
```
┌─ Docker Network ────────────────────────────────────────┐
│                                                         │
│  Traefik (HTTPS + Let's Encrypt) ───────────────────┐  │
│    ├─ https://yourdomain.com → Your App (container) │  │
│    ├─ https://api.yourdomain.com → Kong             │  │
│    └─ https://studio.yourdomain.com → Studio        │  │
│                                                      │  │
│  Complete Self-Hosted Supabase Stack:                │  │
│    ├─ PostgreSQL (persistent volumes + backups)      │  │
│    ├─ Kong API Gateway                               │  │
│    ├─ GoTrue (authentication)                        │  │
│    ├─ PostgREST (database API)                       │  │
│    ├─ Realtime (subscriptions)                       │  │
│    ├─ Storage (file management)                      │  │
│    ├─ Studio (admin UI)                              │  │
│    └─ Postgres Meta (schema management)              │  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key principles:**
- **Identical containers** - Same Docker images in dev and production
- **Same proxy technology** (Traefik) with Let's Encrypt automation
- **Same BaaS stack** - Complete Supabase self-hosted, not external service
- **Same configuration files** - Docker Compose with environment overrides only
- **GitOps deployment** - Deploy exact git commits with infrastructure as code

**Dev/prod parity means:**
- If routing works locally, it works in production
- SSL configuration is identical between environments
- Service discovery patterns are consistent
- No "works on my machine" surprises

## 🛠️ Works With

### BaaS Platforms
- ✅ **Supabase** - Complete self-hosted stack (PostgreSQL, Auth, API, Storage, Studio, Realtime)
- 🚧 **Firebase** - Coming soon
- 🚧 **PocketBase** - Coming soon

### Deployment Targets
- ✅ **Local development** - Standard mode (proxy only) or self-hosted BaaS
- ✅ **Local production testing** - Full production stack on localhost (local.lightstack.dev)
- 🚧 **Remote servers** - GitOps deployment via SSH (coming soon)
- 🚧 **Docker-compatible platforms** - VPS, cloud instances, dedicated servers

### Frameworks
- **Any web framework** that runs on localhost (React, Vue, Nuxt, Next.js, SvelteKit, etc.)
- **Your existing tools** - Keep using `npm run dev`, standard development workflow

## 📚 Documentation

Full documentation coming soon at [cli.lightstack.dev](https://cli.lightstack.dev)

## 🧩 Part of Lightstack

This CLI is part of the [Lightstack](https://github.com/lightstack-dev) ecosystem:

- [nuxt-starter](https://github.com/lightstack-dev/nuxt-starter) - Complete Nuxt stack
- [nuxt-auth-ui](https://github.com/lightstack-dev/nuxt-auth-ui) - Drop-in auth components

## 🛣️ Roadmap

### Completed ✅
- [x] **Local HTTPS proxy** - Production-grade reverse proxy with mkcert
- [x] **Self-hosted Supabase** - Complete BaaS stack deployment (8 services)
- [x] **Environment management** - Multiple deployment targets support
- [x] **Automatic migrations** - Database schema management via Supabase CLI
- [x] **Local production testing** - Full production stack on localhost
- [x] **Smart health checks** - Container status monitoring and recovery
- [x] **Configuration management** - Type-safe config with validation
- [x] **Service monitoring** - Status checks and log aggregation

### In Progress 🚧
- [ ] **Remote deployment** - GitOps deployment via SSH
- [ ] **Let's Encrypt SSL** - Automatic HTTPS for production domains
- [ ] **Container image building** - Custom app containerization
- [ ] **Zero-downtime deployments** - Blue-green deployment strategy

### Future 🔮
- [ ] **Additional BaaS platforms** - Firebase, PocketBase, Appwrite
- [ ] **CI/CD integration** - GitHub Actions, GitLab CI templates
- [ ] **Database backups** - Automated backup and restore procedures
- [ ] **Monitoring & observability** - Metrics, tracing, alerting
- [ ] **Team collaboration** - Shared environments, config templates

## 💻 Development

```bash
# Clone and install
git clone https://github.com/lightstack-dev/cli.git
cd cli
npm install

# Run in development
npm run dev

# Run tests
npm test

# Run tests with Bun (alternative)
bun run vitest

# Build for production
npm run build
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © [Lightstack](https://github.com/lightstack-dev)

---

**Skip the boilerplate. Start innovating.**