# =============================================================================
# VeloManage Backend — Multi-stage Dockerfile
# =============================================================================
# Stage 1: build / install all deps (devDeps needed for any build scripts)
# Stage 2: production — only prod deps + source, runs as non-root user
# =============================================================================

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps

# Install build tools needed by native deps (bcryptjs is pure JS but some
# transitive deps compile; tini gives us a proper init for signal forwarding).
RUN apk add --no-cache tini

WORKDIR /app

# Copy lockfile + package.json first to maximise layer caching
COPY package.json package-lock.json* ./

# Install ALL deps (including devDeps) — we'll prune in the prod stage.
# If no lockfile exists we fall back to `npm install`.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# ---------- Stage 2: production ----------
FROM node:20-alpine AS production

# tini = PID 1, handles SIGTERM/SIGINT correctly so Express graceful shutdown works
RUN apk add --no-cache tini curl

WORKDIR /app

ENV NODE_ENV=production \
    PORT=10000 \
    NPM_CONFIG_LOGLEVEL=error

# Copy package manifests
COPY package.json package-lock.json* ./

# Install ONLY production deps (no devDeps) — keeps image lean.
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

# Copy application source (excluding files in root .dockerignore)
COPY --chown=node:node . .

# Ensure uploads dir exists and is owned by node user
RUN mkdir -p uploads && chown -R node:node /app

# Render expects the service to listen on PORT=10000
EXPOSE 10000

# Switch to the built-in non-root user (uid 1000)
USER node

# Healthcheck: hit /health every 30s; mark unhealthy after 3 consecutive fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-10000}/health" || exit 1

# tini entrypoint so we get proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "server.js"]
