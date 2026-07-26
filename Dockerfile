FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
RUN pnpm install --config.strict-peer-dependencies=false --config.dangerouslyAllowAllBuilds=true
RUN pnpm --filter admin build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static /app/apps/admin/.next/static
COPY --from=build /app/apps/admin/public /app/apps/admin/public
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
