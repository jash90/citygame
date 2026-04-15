<!-- Scope: apps/admin — Next.js 15 + React 19 + Tailwind v4 -->
<!-- Source: .claude/rules/{srp,ocp,isp,dip,lsp}.md (Frontend sections) -->

# Admin Panel Agent Rules

Next.js 15 with React 19, Tailwind v4, React Hook Form + Zod, React Query, Leaflet maps.

## Architecture

- `src/app/` — Next.js App Router pages (route groups: `(auth)`, `(dashboard)`).
- `src/components/` — UI components grouped by domain (`analytics/`, `dashboard/`, `editor/`, `game/`, `layout/`, `monitor/`, `settings/`).
- `src/hooks/` — Custom React hooks for data fetching and state logic.
- `src/lib/` — Utility functions and API client configuration.
- `src/providers/` — React Context providers.

## SOLID — Frontend Specific

### SRP

- One component = one UI concern. Separate data fetching (hooks) from presentation (components).
- Extract complex state logic into custom hooks (`useGameState`, `useAuth`).
- Pages compose components — they never contain business logic.

### OCP

- Extend components through props and composition — never fork base components.
- Use render props or children patterns for customizable behavior.
- Add new route handlers/pages instead of adding conditionals to existing ones.

### ISP

- Component props: require only what the component uses. No "God props" objects with 15+ optional fields.
- Prefer composed smaller components over one component with many mode switches.
- Context providers should be scoped — never put all app state into one provider.

### DIP

- Data fetching through hooks/React Query — components never call `fetch` or API clients directly.
- App-level services (auth, storage) through Context providers or hooks.
- Navigation through Next.js router abstractions — never hardcode paths as strings in components.

### LSP

- Components sharing the same props interface must behave consistently.
- Custom hooks returning the same shape (`{ data, error, loading }`) must follow the same lifecycle contract.
- Replacing one data-fetching hook with another must not change the component's behavior.

## Anti-patterns

- Components that fetch, transform, and render in one body.
- A single Props interface with mostly optional fields to serve multiple use cases.
- Components importing API clients or `fetch` directly.
- Editing base component internals to support one new variation.
