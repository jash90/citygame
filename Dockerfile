FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace root + admin + shared package manifests first (for caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --config.strict-peer-dependencies=false --config.dangerouslyAllowAllBuilds=true

# Copy source
COPY . .

# Build admin app
RUN pnpm --filter admin build

# Next.js standalone output
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static /app/apps/admin/.next/static
COPY --from=build /app/apps/admin/public /app/apps/admin/public
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
