![Lightstack logo](https://raw.githubusercontent.com/lightstack-dev/.github/refs/heads/main/assets/lighstack-logo-2025-08-protected.svg)

# Lightstack CLI

> Bridge localhost and production with identical infrastructure patterns

[![npm version](https://img.shields.io/npm/v/@lightstack-dev/cli.svg)](https://www.npmjs.com/package/@lightstack-dev/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Development-to-production infrastructure orchestrator.** Lightstack CLI gives you production-grade patterns in development (HTTPS, reverse proxy, service routing), then deploys with identical infrastructure to production. No surprises, perfect dev/prod parity.

## ✨ Features

### Development Experience
- 🔒 **Production-grade HTTPS** - Real SSL certificates in development
- 🌐 **Clean URLs** - `https://app.lvh.me` instead of `localhost:3000`
- 🔄 **Service discovery** - Auto-proxy BaaS services with consistent URLs
- 🚀 **Zero disruption** - Keep your existing `npm run dev` workflow

### Production Deployment
- 🌍 **Identical infrastructure** - Same Traefik config, different targets
- 📦 **Docker orchestration** - Generate production-ready Docker Compose
- 🔐 **Let's Encrypt SSL** - Automatic HTTPS certificates in production
- 🚀 **Zero-downtime deploys** - Rolling updates with health checks

### Developer Experience
- ⚡ **Dev/prod parity** - What works locally works in production
- 📝 **Infrastructure as code** - Readable, modifiable configurations
- 🎯 **Gradual complexity** - Start simple, scale to multi-environment

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

**Development-to-production infrastructure consistency:**

### Local Development
```
Your App (localhost:3000) ← Traefik Proxy ← https://app.lvh.me
Supabase (localhost:54321) ← Traefik Proxy ← https://api.lvh.me
```

### Production Deployment
```
Your App (Docker container) ← Traefik Proxy ← https://yourdomain.com
Database (managed service) ← Traefik Proxy ← https://api.yourdomain.com
```

**Key principles:**
- **Same proxy technology** (Traefik) in dev and production
- **Same SSL approach** (mkcert locally, Let's Encrypt in production)
- **Same routing patterns** (functional subdomains, service discovery)
- **Same configuration files** (Docker Compose with environment overrides)

**Dev/prod parity means:**
- If routing works locally, it works in production
- SSL configuration is identical between environments
- Service discovery patterns are consistent
- No "works on my machine" surprises

## 🛠️ Works With

### Development
- **Any web framework** that runs on localhost (React, Vue, Nuxt, Next.js, SvelteKit, etc.)
- **BaaS services**: Supabase, PocketBase, Appwrite, Firebase (auto-detected and proxied)
- **Your existing tools**: Keep using `npm run dev`, `supabase start`, etc.

### Production
- **Any Docker-compatible server** (VPS, cloud instances, dedicated servers)
- **Container registries**: Docker Hub, GitHub Container Registry, AWS ECR
- **Domain management**: Cloudflare, Route53, any DNS provider
- **Database services**: Managed PostgreSQL, MongoDB Atlas, PlanetScale

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