# Dependency Inversion Principle (DIP)

High-level modules depend on abstractions, not low-level implementations.

## Backend (NestJS + Prisma)

- Inject dependencies through constructor injection — never import concrete implementations directly.
- NestJS modules bind abstractions to implementations via providers.
- Access Prisma through a service layer — controllers never import `PrismaClient` directly.
- Configuration via `@nestjs/config` and `ConfigService` — business logic never reads `process.env`.
- External services (S3, Google Maps, Socket.IO) are wrapped behind an injectable service so implementations can be swapped.

## Frontend (React / Next.js / Expo)

- Data fetching through hooks/React Query — components never call `fetch` or API clients directly.
- App-level services (auth, storage, notifications) through Context providers or hooks.
- Navigation through abstractions (Expo Router, Next.js router) — never hardcode platform-specific navigation.

## Shared (`packages/shared`)

- Shared types define the contract. Each app implements the contract with its own platform specifics.
- Never import app-specific code from the shared package.

## Anti-patterns

- `new ConcreteClass()` in business logic.
- Components importing API clients or `fetch` directly.
- Business logic reading environment variables with `process.env.X`.
- Shared package depending on a specific app's implementation.
