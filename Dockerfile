FROM node:22-alpine AS build
RUN npm install -g bun
WORKDIR /app
COPY . .
RUN bun install
RUN cd apps/landing && npx astro build

FROM nginx:alpine
COPY --from=build /app/apps/landing/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
