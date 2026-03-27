# ── Stage 1: Install dependencies ──────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json ./

# Copy only the package.json files needed for install
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (dev included for build step)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy installed dependencies from deps stage (hoisted to root node_modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/
COPY pnpm-workspace.yaml package.json .npmrc ./

# Build shared package first
RUN cd packages/shared && pnpm run build

# Generate Prisma client
RUN cd apps/backend && npx prisma generate

# Build backend
RUN cd apps/backend && pnpm run build

# ── Stage 3: Production image ──────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Copy workspace root for module resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./

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
