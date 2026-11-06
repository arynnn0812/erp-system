# Web image: the Vite build served by nginx, which also proxies /api to the
# API container so the browser sees one origin (no CORS, SameSite=strict
# cookies work). Build from the repository root:
#   docker build -f frontend/Dockerfile -t erp-web .

# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- runtime ---
# nginx-unprivileged runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.28-alpine
# Templates are rendered with envsubst at container start; only variables
# that are defined get replaced, so nginx's own $host, $uri... are untouched.
ENV API_UPSTREAM=api:4000
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
