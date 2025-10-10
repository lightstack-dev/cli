# Multi-stage Dockerfile template for Node.js applications
# This is a template file used by Lightstack CLI
# It will be customized based on your project's package.json

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app .

# Switch to non-root user
USER nodejs

# Expose default port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]