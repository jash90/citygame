<!-- Scope: apps/landing — Astro 5 static site -->

# Landing Page Agent Rules

Astro 5 static site for the CityGame landing page.

## Architecture

- Astro components for static content — no client-side JavaScript unless explicitly needed.
- Use Astro's built-in image optimization for all assets.
- Keep pages thin — compose from reusable Astro components.

## SOLID — Landing Specific

### SRP

- One component = one visual section. Separate layout from content.
- Keep files under 300 lines.

### OCP

- Add new sections as new components — never modify existing section components to add unrelated content.

### ISP

- Component props: require only what the component renders.

### DIP

- Use Astro's built-in APIs (Image, Content Collections) — don't reach for external build tools or scripts.

### LSP

- Components sharing the same props interface must render consistently.

## Anti-patterns

- Adding client-side JavaScript to components that don't need it.
- Monolithic page files with inline sections instead of composed components.
- Modifying an existing section component to shoehorn in unrelated content.
