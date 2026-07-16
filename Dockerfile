# syntax=docker/dockerfile:1

# Standalone Next.js image for the Kubikraum Akademie site, plus a `migrator`
# stage used by the one-shot `migrate` compose service (drizzle-kit push + seed).

# ---- deps: install full node_modules (used by builder + migrator) ----
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- migrator: applies the schema + seeds (one-shot compose service) ----
FROM node:24-slim AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "migrate"]

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

# ---- runner: minimal runtime image ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The official node image already ships a non-root `node` user (uid 1000).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ---- railway: runner + migration toolkit, MUST stay the LAST stage ----
# Railway builds the last stage of the Dockerfile. Its pre-deploy command
# (`npm run migrate`, see railway.json) runs in a separate container from THIS
# image, so drizzle-kit + schema + seed have to be inside it. The full
# node_modules is a superset of the pruned standalone one, so overlaying it
# is safe. Coolify/GH-Actions keep using the slim `runner` via --target.
FROM node:24-slim AS railway
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json drizzle.config.ts ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node scripts ./scripts

USER node
EXPOSE 3000
CMD ["node", "server.js"]
