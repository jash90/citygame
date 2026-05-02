# ── Stage 1: Install dependencies ──────────────────────────
# Use the official bun image for install + build; switch to node-alpine for the
# runtime image so we keep a small surface and run the compiled JS under node.
FROM oven/bun:1.3.11-alpine AS deps
WORKDIR /app

# Copy workspace root config
COPY package.json bun.lock ./
COPY tsconfig.base.json ./

# Copy all workspace package.json files so bun.lock matches the workspace
# topology. Missing siblings cause `bun install --frozen-lockfile` to
# reject the (otherwise valid) lockfile.
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/
COPY apps/backend/package.json ./apps/backend/
COPY apps/landing/package.json ./apps/landing/
COPY apps/mobile/package.json ./apps/mobile/

# Install all dependencies (dev included for build step). Bun runs lifecycle
# scripts only for packages listed under `trustedDependencies` in package.json.
RUN bun install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

# Bun uses a per-package node_modules layout (not pnpm-style hoisting), so
# copy the install output for every workspace we will build against, plus
# the root cache. The workspace package.json files came over with the deps
# stage already.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/shared/package.json ./packages/shared/
COPY --from=deps /app/apps/backend/package.json ./apps/backend/

# Copy source code (node_modules excluded by .dockerignore, so the
# COPY merges into the existing dirs without clobbering install output).
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/
COPY package.json ./

# Build shared package first
RUN cd packages/shared && bun run build

# Generate Prisma client
RUN cd apps/backend && bunx prisma generate

# Build backend
RUN cd apps/backend && bun run build

# ── Stage 3: Production image ──────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Workspace root for module resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Built shared package + its install output (zod, etc.)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules

# Built backend + its install output (includes the @citygame/shared
# workspace symlink and the generated Prisma client at .prisma/).
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

# Prisma schema is needed at runtime for `prisma migrate deploy`.
COPY --from=builder /app/apps/backend/src/prisma ./apps/backend/src/prisma

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/apps/backend
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
