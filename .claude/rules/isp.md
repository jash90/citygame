# Interface Segregation Principle (ISP)

No client should depend on interfaces it does not use.

## TypeScript Interfaces

- Keep interfaces small and focused. Split `IUserService` into `IUserReader` and `IUserWriter` if consumers only need one.
- Prefer multiple narrow types over one wide type with optional fields.

## Backend (NestJS + Prisma)

- Separate DTOs per operation: `CreateUserDto`, `UpdateUserDto`, `UserResponseDto` — never one DTO for all.
- API endpoints return only the data the client needs — don't expose the full Prisma model.
- Controller methods accept only the parameters they use.

## Frontend (React / Next.js / Expo)

- Component props: require only what the component uses. No "God props" objects with 15+ optional fields.
- Prefer composed smaller components over one component with many mode switches.
- Context providers should be scoped — don't put all app state into one provider.

## Shared (`packages/shared`)

- Export granular types, not monolithic barrel files.
- If a mobile client only needs `GamePin` type, it shouldn't import the entire `game.types.ts` with admin-only types.

## Anti-patterns

- A single Props interface with mostly optional fields to serve multiple use cases.
- A DTO that requires fields only needed by a different operation.
- Importing a massive shared module to use one type.
