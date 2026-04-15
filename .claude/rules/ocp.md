# Open/Closed Principle (OCP)

Software entities are open for extension, closed for modification.

## Backend (NestJS + Prisma)

- Extend behavior with NestJS decorators, guards, interceptors, and pipes — don't modify existing controllers.
- Add new strategy/handler classes instead of growing if/else or switch chains.
- Use Prisma middleware or NestJS interceptors for cross-cutting concerns (audit logs, soft deletes).
- New game mechanics = new module, not modifications to existing game service.

## Frontend (React / Next.js / Expo)

- Extend components through props and composition — don't fork base components.
- Use render props or children patterns for customizable behavior.
- Add new route handlers/pages instead of adding conditionals to existing ones.

## Configuration

- Feature variations through config/env, not code branches.
- New environments = new `.env` file, not if/else on `NODE_ENV`.

## Anti-patterns

- Modifying existing switch/if-else blocks for new features.
- Changing shared utility functions to handle edge cases of a single caller.
- Editing base component internals to support one new variation.
