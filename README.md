![Lighstack logo](https://raw.githubusercontent.com/lightstack-dev/.github/refs/heads/main/assets/lighstack-logo-2025-08-protected.svg)

# Lightstack CLI

> Development and deployment orchestrator for BaaS platforms

[![npm version](https://img.shields.io/npm/v/@lightstack/cli.svg)](https://www.npmjs.com/package/@lightstack/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bridge the gap between `localhost` and production. Lightstack CLI orchestrates your entire development workflow with automated deployments, SSL/TLS setup, and seamless BaaS integration.

## ✨ Features

- 🚀 **One Command Everything** - Start your entire stack with `lightstack dev`
- 🔒 **SSL in Development** - Production parity with local HTTPS
- 📦 **Smart Orchestration** - Coordinates Nuxt, Supabase, and other services
- 🌍 **Deploy Anywhere** - Push to any VPS (Hetzner, DigitalOcean, etc.)
- 🔄 **Pass-through Architecture** - Enhanced Supabase CLI, not a replacement
- 🎯 **Zero Config** - Smart defaults with escape hatches when needed

## 🚀 Quick Start

```bash
# Install globally
npm install -g @lightstack/cli

# Initialize in your project
lightstack init

# Start development
lightstack dev

# Deploy to production
lightstack deploy production
```

## 📋 Requirements

- Node.js 18+
- Docker (for local development and deployment)
- Git

## 🛠️ Installation

### Global Installation (Recommended)

```bash
npm install -g @lightstack/cli
```

### Per-Project Installation

```bash
npm install --save-dev @lightstack/cli
```

Add to your `package.json`:
```json
{
  "scripts": {
    "dev": "lightstack dev",
    "deploy": "lightstack deploy"
  }
}
```

## 📖 Usage

### Development

Start your complete development environment:

```bash
lightstack dev
```

This command:
- ✅ Starts Supabase (if not running)
- ✅ Runs database migrations
- ✅ Seeds test data
- ✅ Starts your Nuxt app
- ✅ Sets up SSL certificates (optional)
- ✅ Opens your browser

### Deployment

#### First Time Setup

Initialize deployment configuration:

```bash
lightstack deploy init production
```

The interactive wizard will help you configure:
- 🖥️ Target server (VPS hostname/IP)
- 🌐 Domain configuration
- 🔒 SSL certificates (Let's Encrypt)
- 🔑 SSH access
- 🔐 Secrets generation

#### Deploy

```bash
lightstack deploy production
```

Handles everything:
- Docker image building
- Secret management
- SSL certificate provisioning
- Zero-downtime deployment
- Health checks

### Pass-through Commands

All Supabase CLI commands work as expected:

```bash
# These pass through to Supabase CLI
lightstack db reset
lightstack migration new
lightstack functions deploy
```

## 🔧 Configuration

### Project Configuration

`.lightstack/config.yml`
```yaml
# Local development
local:
  ssl: true
  domain: app.local.lightstack.dev

# Deployment targets
deployments:
  production:
    host: your-server.com
    domain: app.yourdomain.com
    ssl:
      provider: letsencrypt
      email: admin@yourdomain.com
```

### Environment Variables

`.lightstack/.env.production`
```bash
# Auto-generated secrets
POSTGRES_PASSWORD=...
JWT_SECRET=...

# Your configuration
SMTP_HOST=...
SMTP_USER=...
```

## 🏗️ Architecture

Lightstack CLI enhances existing tools rather than replacing them:

```
Your Commands → Lightstack CLI → Enhanced Actions
                       ↓
                Pass-through → Supabase CLI (unchanged commands)
```

## 🤝 Works With

- **Frameworks**: Nuxt (first-class), Next.js, SvelteKit, Vue, React
- **BaaS**: Supabase (current), PocketBase & Appwrite (planned)
- **Deployment**: Any VPS with Docker support
- **CI/CD**: GitHub Actions, GitLab CI, Bitbucket Pipelines

## 📚 Documentation

- [Full Documentation](https://github.com/lightstack-dev/cli/wiki)
- [Deployment Guide](https://github.com/lightstack-dev/cli/wiki/deployment)
- [Configuration Reference](https://github.com/lightstack-dev/cli/wiki/configuration)

## 🧩 Part of Lightstack

This CLI is part of the [Lightstack](https://github.com/lightstack-dev) ecosystem:

- [nuxt-starter](https://github.com/lightstack-dev/nuxt-starter) - Complete Nuxt stack
- [nuxt-auth-ui](https://github.com/lightstack-dev/nuxt-auth-ui) - Drop-in auth components

## 🛣️ Roadmap

- [x] Supabase orchestration
- [x] VPS deployment automation
- [ ] PocketBase adapter
- [ ] Appwrite adapter
- [ ] Kubernetes deployment
- [ ] Multi-region deployment

## 💻 Development

```bash
# Clone the repository
git clone https://github.com/lightstack-dev/cli.git
cd cli

# Install dependencies
npm install

# Run locally
npm run dev

# Build
npm run build

# Test
npm test
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © [Lightstack](https://github.com/lightstack-dev)

---

Made with ❤️ for the developer community
