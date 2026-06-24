# =============================================================================
# VeloManage Frontend — Multi-stage Dockerfile
# =============================================================================
# Stage 1: build the Vite/React app with node:20-alpine
# Stage 2: serve the static dist/ with nginx:alpine
# =============================================================================

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build

WORKDIR /app

# Copy lockfile + package.json first for better layer caching
COPY package.json package-lock.json* ./

RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# Copy the rest of the source and build
COPY . .

# Build outputs to /app/dist by default (see vite.config.js)
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM nginx:alpine AS runtime

# Remove default nginx static assets & config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy our SPA-aware nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Make sure nginx runs as non-root where possible. nginx:alpine image already
# runs the master process as root by default and workers as nginx user (101).
# For strict non-root deployments, see the alternative `nginxinc/nginx-unprivileged`
# image. We expose port 80 (the convention for HTTP).
EXPOSE 80

# nginx already has healthcheck-friendly defaults; add an explicit one.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
