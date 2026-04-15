# Single Responsibility Principle (SRP)

Every module, class, and function has exactly one reason to change.

## Backend (NestJS + Prisma)

- One service = one domain entity. `UserService` handles users, not users + auth + notifications.
- Controllers handle HTTP mapping only — no business logic in controllers.
- Services own business logic. Repositories/Prisma calls live in the service or a dedicated repository.
- Keep files under 300 lines. If a service grows beyond that, extract a focused sub-service.

## Frontend (React / Next.js / Expo)

- One component = one UI concern. Separate data fetching (hooks) from presentation (components).
- Extract complex state logic into custom hooks (`useGameState`, `useAuth`).
- Pages compose components — they don't contain business logic.

## Shared (`packages/shared`)

- One export = one concept. Don't bundle unrelated types in a single file.
- Group by domain (`user.types.ts`, `game.types.ts`), not by kind (`interfaces.ts`, `enums.ts`).

## Anti-patterns

- God services that handle multiple unrelated domains.
- Components that fetch, transform, and render in one body.
- Utility files that grow into catch-all dumping grounds.
