<!-- Scope: packages/shared — shared types and utilities -->
<!-- Source: .claude/rules/{srp,isp,dip}.md (Shared sections) -->

# Shared Package Agent Rules

Shared TypeScript types, constants, utilities, and validation schemas consumed by all apps.

## Architecture

- `types/` — TypeScript type definitions grouped by domain.
- `constants/` — Shared constants.
- `utils/` — Pure utility functions.
- `validation/` — Shared Zod/validation schemas.
- `index.ts` — Public API barrel export.

## SOLID — Shared Specific

### SRP

- One export = one concept. Never bundle unrelated types in a single file.
- Group by domain (`user.types.ts`, `game.types.ts`), not by kind (`interfaces.ts`, `enums.ts`).

### ISP

- Export granular types, not monolithic barrel files.
- If a mobile client only needs `GamePin` type, it must not be forced to import admin-only types.
- Prefer targeted imports (`@citygame/shared/types/game`) over the root barrel when possible.

### DIP

- Shared types define the contract. Each app implements the contract with its own platform specifics.
- Never import app-specific code from the shared package.
- Never depend on runtime behavior from a specific app — this package is type/utility only.

## Anti-patterns

- Utility files that grow into catch-all dumping grounds.
- Importing a massive shared module to use one type.
- Shared package depending on a specific app's implementation.
