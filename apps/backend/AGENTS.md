<!-- Scope: apps/backend — NestJS 10 + Prisma + PostgreSQL -->
<!-- Source: .claude/rules/{srp,ocp,isp,dip}.md (Backend sections) -->

# Backend Agent Rules

NestJS 10 with Prisma ORM, PostgreSQL, Socket.IO, and JWT authentication.

## Architecture

- Controllers handle HTTP mapping only — never put business logic in controllers.
- Services own business logic. Repositories/Prisma calls live in the service or a dedicated repository.
- One service = one domain entity. `UserService` handles users, not users + auth + notifications.
- Domain modules live in `src/modules/`. Each module is self-contained (controller, service, DTOs, guards).

## SOLID — Backend Specific

### SRP

- One service = one domain entity.
- Controllers map HTTP to service calls — nothing else.
- Keep files under 300 lines. If a service grows beyond that, extract a focused sub-service.

### OCP

- Extend behavior with NestJS decorators, guards, interceptors, and pipes — never modify existing controllers.
- Use Prisma middleware or NestJS interceptors for cross-cutting concerns (audit logs, soft deletes).
- New game mechanics = new module, not modifications to existing game service.

### ISP

- Separate DTOs per operation: `CreateUserDto`, `UpdateUserDto`, `UserResponseDto` — never one DTO for all.
- API endpoints return only the data the client needs — never expose the full Prisma model.
- Controller methods accept only the parameters they use.

### DIP

- Inject dependencies through constructor injection — never import concrete implementations directly.
- NestJS modules bind abstractions to implementations via providers.
- Access Prisma through a service layer — controllers never import `PrismaClient` directly.
- Configuration via `@nestjs/config` and `ConfigService` — business logic never reads `process.env`.
- External services (S3, Google Maps, Socket.IO) are wrapped behind an injectable service so implementations can be swapped.

### LSP

- All implementations of a service interface must handle the same error cases.
- Repository methods must return the same shape regardless of underlying query strategy.
- DTOs validated with class-validator/Zod must always produce the declared shape.

## Anti-patterns

- God services that handle multiple unrelated domains.
- Business logic in controllers.
- `new ConcreteClass()` in services.
- Modifying existing switch/if-else blocks for new features.
- A DTO that requires fields only needed by a different operation.
