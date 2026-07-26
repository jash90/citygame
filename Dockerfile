FROM node:22-alpine AS build
RUN npm install -g bun
WORKDIR /app
COPY . .
RUN bun install
RUN cd apps/admin && npx next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static /app/apps/admin/.next/static
COPY --from=build /app/apps/admin/public /app/apps/admin/public
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
