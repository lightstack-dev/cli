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
- Docker Desktop (for local proxy infrastructure)
- [mkcert](https://github.com/FiloSottile/mkcert) (auto-installed, for local HTTPS)

### Production (Optional)
- Docker-compatible VPS or cloud server
- Domain name for your application

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

### Initialize Proxy Configuration

```bash
light init
```

This creates:
- `light.config.yaml` - Proxy configuration
- `.light/` directory with Traefik configuration

### Development Workflow

```bash
# 1. Start the proxy (only needs to be done once)
light up

# 2. Start your app normally (separate terminal)
npm run dev
# or: yarn dev, bun dev, pnpm dev, etc.

# 3. Access via nice URLs
# https://app.lvh.me → your app
# https://router.lvh.me → routing dashboard
```

**With Supabase** (auto-detected):
```bash
# Start Supabase normally
supabase start

# Start Lightstack proxy
light up

# Start your app
npm run dev

# Access everything via HTTPS:
# https://app.lvh.me → your app
# https://api.lvh.me → Supabase API
# https://studio.lvh.me → Supabase Studio
```

### Deployment (Coming Soon)

The `light deploy` command is under development. Once complete, it will handle:
- Docker image building
- File upload to server
- Traefik configuration with Let's Encrypt
- Zero-downtime deployment
- Automatic rollback on failure

### Other Commands

```bash
light down             # Stop proxy
light status           # Show proxy and service status
light logs             # View proxy logs
light logs traefik     # View specific service logs
light --help           # Show all available commands
light --version        # Show CLI version

# Aliases
light start            # Same as "light up"
light stop             # Same as "light down"
light ps               # Same as "light status"
```

**Note**: Lightstack CLI only handles local development proxying. Use your existing tools normally (`npm run dev`, `supabase start`, etc.).

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
```

### Domain Configuration (Optional)

```yaml
name: my-project
domain: lvh.me        # Default, or use custom.dev, localhost.test, etc.
services:
  - name: app
    port: 3000
    # Results in: https://app.{domain}
```

### Environment Variables (Optional)

```bash
# .env
PROJECT_NAME=my-project
```

## 🏗️ Architecture

**Complete self-hosted BaaS stack with identical dev/prod infrastructure:**

### Local Development
```
┌─ Docker Network ────────────────────────────────────────┐
│                                                         │
│  Your App (localhost:3000) ← Traefik ← https://app.lvh.me    │
│  ├─ Supabase API           ← Traefik ← https://api.lvh.me    │
│  ├─ Supabase Studio        ← Traefik ← https://studio.lvh.me │
│  ├─ PostgreSQL (container)                             │
│  ├─ Supabase Auth                                      │
│  └─ Supabase Storage                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Production Deployment (Identical Stack)
```
┌─ Docker Network ────────────────────────────────────────┐
│                                                         │
│  Your App (container)      ← Traefik ← https://yourdomain.com   │
│  ├─ Supabase API           ← Traefik ← https://api.yourdomain.com │
│  ├─ Supabase Studio        ← Traefik ← https://studio.yourdomain.com │
│  ├─ PostgreSQL (container) [persistent volumes]       │
│  ├─ Supabase Auth                                      │
│  └─ Supabase Storage                                   │
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

### Development
- **Any web framework** that runs on localhost (React, Vue, Nuxt, Next.js, SvelteKit, etc.)
- **Self-hosted BaaS**: Complete Supabase stack (PostgreSQL, Auth, API, Storage, Studio)
- **Your existing tools**: Keep using `npm run dev`, standard development workflow
- **Optional**: Use hosted BaaS services if you prefer (Supabase hosted, Firebase, etc.)

### Production
- **Any Docker-compatible server** (VPS, cloud instances, dedicated servers)
- **Self-hosted database**: PostgreSQL with persistent volumes and automated backups
- **Complete BaaS stack**: All Supabase services self-hosted on your infrastructure
- **Cost control**: Predictable server costs instead of per-usage BaaS pricing
- **Data sovereignty**: Your data stays on your servers, full compliance control

## 📚 Documentation

Full documentation coming soon at [cli.lightstack.dev](https://cli.lightstack.dev)

## 🧩 Part of Lightstack

This CLI is part of the [Lightstack](https://github.com/lightstack-dev) ecosystem:

- [nuxt-starter](https://github.com/lightstack-dev/nuxt-starter) - Complete Nuxt stack
- [nuxt-auth-ui](https://github.com/lightstack-dev/nuxt-auth-ui) - Drop-in auth components

## 🛣️ Roadmap

### Completed ✅
- [x] **Local development**: Production-grade proxy with HTTPS
- [x] **Service discovery**: Auto-detect and proxy BaaS services
- [x] **Infrastructure consistency**: Same Traefik patterns dev to prod
- [x] **Configuration management**: Type-safe config with validation
- [x] **Basic deployment**: Docker Compose generation and deployment structure
- [x] **Monitoring**: Service status and log aggregation

### In Progress 🚧
- [ ] **Production deployment**: Full zero-downtime deployment pipeline
- [ ] **Multi-environment**: Staging, preview environments
- [ ] **Additional BaaS**: Firebase, PocketBase auto-detection

### Future 🔮
- [ ] **CI/CD integration**: GitHub Actions, GitLab CI templates
- [ ] **Monitoring & observability**: Metrics, tracing, alerting
- [ ] **Team collaboration**: Shared environments, config templates

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