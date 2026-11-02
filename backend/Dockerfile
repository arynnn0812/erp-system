# API image. Build from the repository root (the migration runner reads
# ../database/migrations):
#   docker build -f backend/Dockerfile -t erp-api .
# The same image runs the API (default), migrations and the seed scripts:
#   docker run --env-file backend/.env erp-api node scripts/migrate.js

# --- dependencies: production only, from the lockfile ---
FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# --- runtime ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/backend

# Files stay owned by root and the process runs as the unprivileged `node`
# user, so a compromised process cannot rewrite its own code.
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY database/migrations /app/database/migrations
USER node

EXPOSE 4000
# Liveness only: a database outage should mark the API unready, not get the
# container restarted. Node's fetch avoids needing curl/wget in the image.
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# exec form: node is PID 1 and receives SIGTERM, which starts the graceful
# shutdown in src/server.js (npm start would swallow the signal).
CMD ["node", "src/server.js"]
