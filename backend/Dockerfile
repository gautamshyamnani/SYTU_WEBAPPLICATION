# ─── Dockerfile — auth-backend ────────────────────────────────────────────────
#
# Multi-stage build:
#   1. deps  — installs node_modules (cached separately so code changes don't
#              force a full reinstall)
#   2. final — copies deps + source into a slim runtime image, runs as a
#              non-root user, exposes the API port, starts the server.
#
# Build:  docker build -t auth-backend .
# Run:    docker run --env-file .env -p 5000:5000 auth-backend
# (Normally you'll use docker-compose instead — see docker-compose.yml.)

# ─── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Only copy manifest files first so this layer is cached unless deps change
COPY package.json package-lock.json ./

# npm ci is faster and reproducible — installs exactly what's in the lockfile.
# --omit=dev keeps nodemon etc. out of the production image.
RUN npm ci --omit=dev

# ─── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS final

# Lightweight init — forwards SIGTERM/SIGINT to the Node process correctly
# (Node running as PID 1 doesn't handle signals or reap zombie processes by
# default). Without this, `docker stop` can hang or kill the container
# ungracefully instead of letting server.js's shutdown handler run.
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user (security best practice — never run as root in prod)
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

COPY --chown=nodeuser:nodejs --from=deps /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs package.json package-lock.json ./
COPY --chown=nodeuser:nodejs src ./src

# logs/ is created at runtime by config/logger.js — pre-create it with the
# right ownership so the non-root user can write to it.
RUN mkdir -p logs && chown nodeuser:nodejs logs

USER nodeuser

EXPOSE 5000

# Docker-level health check — hits the route added in Slice 14.
# Uses Node directly (no curl/wget in alpine by default) to keep the image small.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
