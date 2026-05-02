# ── Stage 1: Install dependencies ──────────────────────────
# Use the official bun image for install + build; switch to node-alpine for the
# runtime image so we keep a small surface and run the compiled JS under node.
FROM oven/bun:1.3.11-alpine AS deps
WORKDIR /app

# Copy workspace root config
COPY package.json bun.lock ./
COPY tsconfig.base.json ./

# Copy only the package.json files needed for install
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (dev included for build step). Bun runs lifecycle
# scripts only for packages listed under `trustedDependencies` in package.json.
RUN bun install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

# Copy installed dependencies from deps stage (hoisted to root node_modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
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

# Copy workspace root for module resolution
COPY --from=builder /app/package.json ./

# Copy root node_modules (hoisted dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy built shared package
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy built backend
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

# Copy Prisma schema (needed for migrate deploy) and generated client
COPY --from=builder /app/apps/backend/src/prisma ./apps/backend/src/prisma
# Prisma client may be in root node_modules (hoisted) or local - copy both locations
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/apps/backend
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
