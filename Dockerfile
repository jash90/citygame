FROM node:22-alpine AS build
RUN npm install -g bun
WORKDIR /app
COPY . .
RUN bun install
RUN cd apps/admin && npx next build

FROM node:22-alpine AS runner
WORKDIR /app/apps/admin
ENV NODE_ENV=production
COPY --from=build /app/apps/admin/.next ./.next
COPY --from=build /app/apps/admin/public ./public
COPY --from=build /app/apps/admin/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
