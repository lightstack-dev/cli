![Lightstack logo](https://raw.githubusercontent.com/lightstack-dev/.github/refs/heads/main/assets/lighstack-logo-2025-08-protected.svg)

# Lightstack CLI

[![npm version](https://img.shields.io/npm/v/@lightstack-dev/cli.svg)](https://www.npmjs.com/package/@lightstack-dev/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Self-host Supabase in production.** Get production-grade local development with HTTPS, then deploy the identical stack (PostgreSQL, Auth, API, Storage) to your own servers. Escape Supabase Cloud costs while maintaining perfect dev/prod parity.

## Why?

**Cost:** Supabase hosted pricing: $25/month → $2,900/month as you scale. Self-host for $20-200/month.

**Control:** Your PostgreSQL database on your servers. GDPR/HIPAA compliant. No vendor lock-in.

**Dev/Prod Parity:** Identical Docker containers from `localhost` to production. What works locally works in production.

## Quick Start

```bash
# Install
npm install -g @lightstack-dev/cli

# Initialize and start Supabase project, see
# https://supabase.com/docs/guides/local-development

# Initialize Lightstack (adds HTTPS proxy)
light init

# Start Lightstack proxy
light up

# Run your app's dev server
npm run dev

# Access everything via HTTPS
# https://app.lvh.me → your app (localhost:3000)
# https://api.lvh.me → Supabase API
# https://studio.lvh.me → Supabase Studio
# https://router.lvh.me → Traefik dashboard
```

## Requirements

**Development:**

- Node.js 20+
- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/local-development)

**Production:**

- Docker-compatible Linux server (VPS, cloud instance, etc.)
- SSH access to server
- Domain name pointing to your server
- [Let's Encrypt-supported](https://go-acme.github.io/lego/dns/) DNS provider

## Commands

```bash
light init              # Initialize project
light up                # Start local stack
light down              # Stop local stack
light status            # Show service status
light logs [service]    # View logs
light env add [name]    # Add deployment target
```

Full documentation: **https://cli.lightstack.dev** (coming soon)

## What's Included

- ✅ Self-hosted Supabase (PostgreSQL, Auth, API, Storage, Studio, Realtime)
- ✅ Local HTTPS with mkcert
- ✅ Automatic database migrations
- ✅ Environment management
- ✅ Health checks and monitoring
- 🚧 Remote deployment via SSH (coming soon)

## License

MIT © [Lightstack](https://github.com/lightstack-dev)
