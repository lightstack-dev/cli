![Lightstack logo](https://raw.githubusercontent.com/lightstack-dev/.github/refs/heads/main/assets/lighstack-logo-2025-08-protected.svg)

# Lightstack CLI

> Focused orchestration for Lightstack development workflows

[![npm version](https://img.shields.io/npm/v/@lightstack-dev/cli.svg)](https://www.npmjs.com/package/@lightstack-dev/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bridge the gap between `localhost` and production. Lightstack CLI orchestrates your development workflow by generating Docker Compose configurations and leveraging battle-tested tools like Traefik, mkcert, and Docker.

## ✨ Features

- 🚀 **One Command Start** - Launch your entire stack with `light up`
- 🔒 **SSL Everywhere** - HTTPS in development and production
- 📦 **Smart Orchestration** - Coordinates services via Docker Compose
- 🌍 **Deploy Anywhere** - Push to any Docker-compatible VPS
- ⚙️ **Configuration First** - Generate files you can understand and modify
- 🎯 **Focused Scope** - Does one thing well: orchestration

## 🚀 Quick Start

```bash
# Install globally
npm install -g @lightstack-dev/cli

# Initialize in your project
light init my-awesome-app

# Start development environment
light up

# Deploy to production
light deploy production
```

## 📋 Requirements

- Node.js 20+
- Docker Desktop (for local development and deployment)
- Git

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

### Initialize a New Project

```bash
light init my-project
cd my-project
```

This creates:
- `light.config.json` - Project configuration
- Docker Compose files for dev and production
- Environment variable templates
- Local SSL certificates via mkcert

### Development

Start your complete development environment:

```bash
light up
```

This command:
- ✅ Validates Docker is running
- ✅ Starts Traefik reverse proxy with SSL
- ✅ Starts your application services
- ✅ Runs health checks
- ✅ Displays service URLs

Access your services:
- **App**: https://my-project.lvh.me
- **Traefik Dashboard**: https://localhost:8080

### Deployment

#### Configure Production Target

Edit `light.config.json`:
```json
{
  "deployments": [
    {
      "name": "production",
      "host": "your-server.com",
      "domain": "myapp.com",
      "ssl": {
        "enabled": true,
        "provider": "letsencrypt",
        "email": "you@example.com"
      }
    }
  ]
}
```

#### Deploy

```bash
light deploy production
```

Handles everything:
- Docker image building
- File upload to server
- Traefik configuration with Let's Encrypt
- Zero-downtime deployment
- Automatic rollback on failure

### Other Commands

```bash
light status          # Show service status
light logs             # View all service logs
light logs my-app      # View specific service logs
light down             # Stop development environment
```

## 🔧 Configuration

### Project Configuration

`light.config.json`
```json
{
  "name": "my-project",
  "type": "nuxt",
  "services": [
    {
      "name": "my-app",
      "type": "frontend",
      "port": 3000,
      "buildCommand": "npm run build",
      "startCommand": "npm run preview"
    }
  ],
  "deployments": [
    {
      "name": "production",
      "host": "your-server.com",
      "domain": "myapp.com",
      "ssl": {
        "enabled": true,
        "provider": "letsencrypt",
        "email": "admin@myapp.com"
      }
    }
  ]
}
```

### Environment Variables

```bash
# .env.development
NODE_ENV=development
PORT=3000

# .env.production
NODE_ENV=production
PORT=3000
```

## 🏗️ Architecture

Lightstack CLI generates configuration for existing tools:

```
Your Project → Lightstack CLI → Generated Files → Existing Tools
                    ↓
            docker-compose.yml → Docker Compose
            traefik.yml → Traefik (SSL/routing)
            .github/workflows/ → GitHub Actions
```

**Philosophy**: Orchestrate, don't reimplement.

## 🛠️ Works With

- **Frameworks**: Nuxt, SvelteKit, Next.js, React, Vue
- **BaaS**: Supabase, PocketBase, Appwrite (use their CLIs directly)
- **Deployment**: Any VPS with Docker support
- **CI/CD**: GitHub Actions, GitLab CI, Jenkins

## 📚 Documentation

Full documentation coming soon at [cli.lightstack.dev](https://cli.lightstack.dev)

## 🧩 Part of Lightstack

This CLI is part of the [Lightstack](https://github.com/lightstack-dev) ecosystem:

- [nuxt-starter](https://github.com/lightstack-dev/nuxt-starter) - Complete Nuxt stack
- [nuxt-auth-ui](https://github.com/lightstack-dev/nuxt-auth-ui) - Drop-in auth components

## 🛣️ Roadmap

- [x] Docker Compose orchestration
- [x] Traefik SSL automation
- [x] VPS deployment
- [ ] GitHub Actions generation
- [ ] Multi-environment support
- [ ] Plugin system for custom services

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

# Build for production
npm run build
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © [Lightstack](https://github.com/lightstack-dev)

---

**Skip the boilerplate. Start innovating.**