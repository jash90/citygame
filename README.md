# CityGame

City exploration game platform — a monorepo managed with [Turborepo](https://turbo.build/) and [Bun](https://bun.sh/) workspaces.

## Structure

```
apps/
  backend     NestJS 10 + Prisma + PostgreSQL + Socket.IO API
  admin       Next.js 15 + React 19 + Tailwind v4 admin panel
  mobile      Expo 54 + React Native + React Query mobile client
  landing     Astro 5 marketing site
packages/
  shared      Shared types and utilities
```

## Tech Stack

| App | Stack |
|-----|-------|
| `apps/backend` | NestJS 10, Prisma, PostgreSQL, Socket.IO, JWT auth |
| `apps/admin` | Next.js 15, React 19, Tailwind v4, React Hook Form + Zod |
| `apps/mobile` | Expo 54, React Native, React Query |
| `apps/landing` | Astro 5 |
| `packages/shared` | Shared TypeScript types and utilities |

## Requirements

- Node.js ≥ 20
- Bun 1.3.11 (package manager)
- PostgreSQL (for the backend)

## Getting Started

```bash
bun install
cp .env.example .env
bun run db:generate
bun run db:migrate
```

## Scripts

### Development

```bash
bun run dev:backend     # NestJS dev server
bun run dev:admin       # Next.js admin panel (port 3002)
bun run dev:mobile      # Expo dev server
bun run dev:landing     # Astro landing page
```

### Quality

```bash
bun run build           # Build all apps
bun run test            # Run all tests
bun run lint            # Lint all packages
bun run typecheck       # Type-check all packages
bun run format          # Format source files with Prettier
bun run format:check    # Verify formatting
```

### Database

```bash
bun run db:generate     # Generate Prisma client
bun run db:migrate      # Run Prisma migrations
bun run db:seed         # Seed the database
```

## Project Conventions

See [`AGENTS.md`](./AGENTS.md) for the global rule set and [`.claude/rules/`](./.claude/rules/) for SOLID principles enforced across the codebase (SRP, OCP, LSP, ISP, DIP). Each app may define additional domain-specific rules in its own `AGENTS.md`.

## License

Private — all rights reserved.
