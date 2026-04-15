# Liskov Substitution Principle (LSP)

Subtypes must be substitutable for their base types without breaking correctness.

## TypeScript Contracts

- Interfaces define contracts — implementations must honor all return types, error behaviors, and side effects.
- Never throw unexpected exceptions from implementations of a shared interface.
- If a function returns `Promise<User>`, every implementation must resolve with a valid `User` — never `null` without the type declaring it.

## Backend (NestJS)

- All implementations of a service interface must handle the same error cases.
- Repository methods must return the same shape regardless of underlying query strategy.
- DTOs validated with class-validator/Zod must always produce the declared shape.

## Frontend (React)

- Components sharing the same props interface must behave consistently.
- Custom hooks returning the same shape (`{ data, error, loading }`) must follow the same lifecycle contract.
- Replacing one data-fetching hook with another must not change the component's behavior.

## Anti-patterns

- Overriding a method to throw "not implemented".
- A mock/stub that silently behaves differently from the real implementation.
- Returning `null` or `undefined` where the contract specifies a defined type.
