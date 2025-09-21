# Lightstack CLI Quickstart Guide

**Goal**: Get from zero to deployed web application in under 10 minutes

## Prerequisites

Before starting, ensure you have:
- Docker Desktop installed and running
- Node.js 20+ installed
- Git installed
- A VPS server for deployment (optional for local development)

## Step 1: Install Lightstack CLI

```bash
npm install -g @lightstack-dev/cli
light --version
```

**Expected output**: Version number confirming installation

## Step 2: Create a New Project

```bash
mkdir my-awesome-app
cd my-awesome-app
light init
```

**What happens**:
- Creates `light.config.json` with sensible defaults
- Generates Docker Compose files for development and production
- Sets up Traefik reverse proxy configuration
- Installs mkcert and creates local SSL certificates
- Creates environment variable templates

**Expected files created**:
```
my-awesome-app/
├── light.config.json
├── .env.development
├── .env.production
└── .light/
    ├── docker-compose.yml
    ├── docker-compose.dev.yml
    ├── docker-compose.prod.yml
    └── certs/
        ├── localhost.pem
        └── localhost-key.pem
```

## Step 3: Start Development Environment

```bash
light up
```

**What happens**:
- Validates project configuration
- Starts Traefik reverse proxy with SSL
- Starts your application services
- Runs health checks
- Displays service URLs

**Expected output**:
```
✓ Docker daemon running
✓ Validating service configuration
✓ Starting services...
  ↳ traefik (reverse proxy)    https://localhost
  ↳ my-awesome-app (frontend)  https://my-awesome-app.lvh.me
  ↳ supabase (database)        https://supabase.lvh.me

🎉 All services running!

Development URLs:
• App: https://my-awesome-app.lvh.me
• Supabase Studio: https://supabase.lvh.me
• Traefik Dashboard: https://localhost:8080

To stop: light down
```

## Step 4: Verify Everything Works

Open your browser and visit:

1. **https://my-awesome-app.lvh.me** - Your application
   - Should show your app running with valid SSL certificate
   - Certificate should be trusted (thanks to mkcert)

2. **https://supabase.lvh.me** - Supabase Studio
   - Should show Supabase dashboard
   - Ready for database management

3. **https://localhost:8080** - Traefik Dashboard
   - Shows routing configuration
   - Service health status

**Troubleshooting**:
- If lvh.me domains don't resolve, check your DNS settings (should work automatically)
- If SSL warnings appear, run `mkcert -install` manually
- If services fail to start, check `light logs` for details

## Step 5: Make Changes and See Live Updates

1. Edit your application code
2. Changes should automatically reload (if using Nuxt/Vite)
3. Refresh browser to see updates

## Step 6: Set Up for Production (Optional)

If you have a VPS server, configure deployment:

```bash
# Edit light.config.json to add production target
{
  "name": "my-awesome-app",
  "services": [...],
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

## Step 7: Deploy to Production

```bash
light deploy production
```

**What happens**:
- Builds production containers
- Uploads to your server via SSH
- Deploys with zero downtime
- Configures Traefik with Let's Encrypt SSL
- Runs health checks
- Rolls back automatically if anything fails

**Expected output**:
```
✓ Building production containers...
✓ Uploading to production server
✓ Configuring Traefik with Let's Encrypt
✓ Deploying with zero downtime
✓ Health checks passed
✓ SSL certificate obtained

🚀 Deployment successful!

Your app is live at: https://myapp.com
Deployment ID: dep_2025091801
```

## Common Commands

```bash
# Check status of all services
light status

# View logs from all services
light logs

# View logs from specific service
light logs my-awesome-app

# Stop development environment
light down

# Restart with fresh build
light down && light up --build

# Deploy with dry run (see what would happen)
light deploy production --dry-run
```

## Integration with Other Tools

Lightstack CLI works alongside your existing tools:

```bash
# Use Supabase CLI directly
supabase db reset
supabase functions deploy

# Use npm/yarn as usual
npm run test
npm run build

# Use git normally
git add . && git commit -m "Add feature"
git push

# Deploy automatically triggers via GitHub Actions (if configured)
```

## Validation Checklist

After completing this quickstart, you should have:

- ✅ Lightstack CLI installed and working
- ✅ New project created with all configuration files
- ✅ Local development environment running with SSL
- ✅ All services accessible via HTTPS URLs
- ✅ (Optional) Production deployment working
- ✅ Understanding of basic Lightstack CLI commands

## What's Missing from MVP

This quickstart intentionally omits advanced features:
- Custom service definitions
- Multiple environment configurations
- CI/CD pipeline generation
- Database migrations
- Monitoring and logging
- Plugin system

These will be added in future iterations based on user feedback.

## Getting Help

- `light --help` - General help
- `light [command] --help` - Command-specific help
- `light status` - Current project status
- Check Docker containers: `docker ps`
- View all logs: `light logs --follow`

---

**Success metric**: A developer should be able to complete Steps 1-5 in under 5 minutes and have a working HTTPS development environment.