# syntax=docker/dockerfile:1

# Runtime image for the Kubikraum Akademie site. The container migrates the
# schema on start and only then serves (scripts/start.sh) — that is what makes
# Coolify's rolling update safe: the previous container keeps serving until this
# one reports healthy, so a failed migration aborts the deploy instead of taking
# the site down.

# ---- deps: install full node_modules (used by builder + runner) ----
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js standalone output ----
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders; real values are injected at runtime by Coolify.
# The DB pool is opened lazily (lib/db.ts) and all DB pages are force-dynamic,
# so the placeholder is never actually connected to during the build.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV SESSION_SECRET=build-time-placeholder-secret-build-time-placeholder
RUN npm run build

# ---- runner: the only image that ships ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The official node image already ships a non-root `node` user (uid 1000).
# Uploaded videos live on a named volume mounted here. Creating the directory
# with the right owner IN THE IMAGE matters: Docker seeds a freshly created
# volume from the mount point, owner included. Without this the volume would
# belong to root while the container runs as `node`, and every upload fails
# with EACCES.
RUN mkdir -p /data/media && chown node:node /data/media

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Migration toolkit. The standalone output ships a pruned node_modules; the full
# one is a superset, so overlaying it is safe — and it must come AFTER the
# standalone copy for exactly that reason. drizzle-kit reads the TypeScript
# schema directly, hence lib/ and drizzle.config.ts as source.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json drizzle.config.ts ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node --chmod=0755 scripts ./scripts

USER node
EXPOSE 3000

# node:24-slim carries neither curl nor wget (checked), so the probe runs in
# Node. The generous start period covers the migration, which happens before the
# server accepts anything and is slow on the production box.
HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./scripts/start.sh"]
