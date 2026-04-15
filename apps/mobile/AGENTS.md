<!-- Scope: apps/mobile — Expo 54 + React Native + React Query -->
<!-- Source: .claude/rules/{srp,ocp,isp,dip,lsp}.md (Frontend sections) -->

# Mobile App Agent Rules

Expo 54 with React Native, Expo Router, React Query, and Zustand stores.

## Architecture

- `app/` — Expo Router file-based routes (route groups: `(auth)`, `(tabs)`, `(modals)`).
- `src/components/` — Reusable UI components.
- `src/hooks/` — Custom React hooks.
- `src/lib/` — Utility functions and API client configuration.
- `src/providers/` — React Context providers.
- `src/services/` — Platform service abstractions.
- `src/stores/` — Zustand state stores.

## SOLID — Mobile Specific

### SRP

- One component = one UI concern. Separate data fetching (hooks) from presentation (components).
- Extract complex state logic into custom hooks or Zustand stores.
- Route screens compose components — they never contain business logic.

### OCP

- Extend components through props and composition — never fork base components.
- Add new route screens instead of adding conditionals to existing ones.
- Use render props or children patterns for customizable behavior.

### ISP

- Component props: require only what the component uses. No "God props" objects with 15+ optional fields.
- Prefer composed smaller components over one component with many mode switches.
- Context providers and Zustand stores should be scoped by domain — never one global store for everything.

### DIP

- Data fetching through hooks/React Query — components never call `fetch` or API clients directly.
- App-level services (auth, storage, notifications) through Context providers, hooks, or `src/services/`.
- Navigation through Expo Router abstractions — never hardcode platform-specific navigation.

### LSP

- Components sharing the same props interface must behave consistently.
- Custom hooks returning the same shape (`{ data, error, loading }`) must follow the same lifecycle contract.
- Replacing one data-fetching hook with another must not change the component's behavior.

## Anti-patterns

- Components that fetch, transform, and render in one body.
- A single Props interface with mostly optional fields to serve multiple use cases.
- Components importing API clients or `fetch` directly.
- One Zustand store handling all app state.
