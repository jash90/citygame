<!-- Scope: Global project rules — applies to all apps and packages -->
<!-- SOLID details live in .claude/rules/{srp,ocp,lsp,isp,dip}.md -->

# CityGame — Agent Rules

Monorepo (pnpm + Turborepo) — city exploration game platform.

## Tech Stack

| App | Stack |
|-----|-------|
| `apps/backend` | NestJS 10, Prisma, PostgreSQL, Socket.IO, JWT auth |
| `apps/mobile` | Expo 54, React Native, React Query |
| `apps/admin` | Next.js 15, React 19, Tailwind v4, React Hook Form + Zod |
| `apps/landing` | Astro 5 |
| `packages/shared` | Shared types and utilities |

## Commands

```
pnpm dev:backend          # NestJS dev server
pnpm dev:admin            # Next.js admin panel (port 3002)
pnpm dev:mobile           # Expo dev server
pnpm dev:landing          # Astro landing page
pnpm build                # Build all apps
pnpm test                 # Run all tests
pnpm lint                 # Lint all
pnpm typecheck            # Type-check all
pnpm format               # Format all source files
pnpm format:check         # Check formatting
pnpm db:migrate           # Prisma migrations
pnpm db:generate          # Generate Prisma client
pnpm db:seed              # Seed database
```

## Language

Always respond in English.

## Ground Rules

- Do what was asked — nothing more, nothing less.
- Prefer editing existing files over creating new ones.
- Never create documentation files unless explicitly requested.
- Never save working files or tests to the repository root.

## SOLID Principles

This project enforces SOLID across all apps. Detailed rules live in `.claude/rules/`:

- **SRP** → `.claude/rules/srp.md` — one reason to change, files under 300 lines
- **OCP** → `.claude/rules/ocp.md` — extend, don't modify
- **LSP** → `.claude/rules/lsp.md` — substitutable implementations
- **ISP** → `.claude/rules/isp.md` — small focused interfaces
- **DIP** → `.claude/rules/dip.md` — depend on abstractions

Domain-specific rules live in each app's `AGENTS.md`.
