/**
 * Shared CORS origin matching utilities.
 * Used by both the HTTP server (main.ts) and WebSocket gateway.
 */

/**
 * Parse CORS_ORIGIN env var into an array of allowed origin patterns.
 * Supports exact matches and wildcard patterns (e.g., *.vercel.app).
 *
 * In production, if CORS_ORIGIN is not set, allows citygame*.vercel.app
 * and localhost origins as sensible defaults.
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;

  if (raw) {
    return raw.split(',').map((o) => o.trim());
  }

  // Sensible defaults when CORS_ORIGIN is not explicitly configured
  const defaults = ['http://localhost:3000', 'http://localhost:3002'];

  if (process.env.NODE_ENV === 'production') {
    // In production, also allow Vercel preview/production deployments
    defaults.push('*.vercel.app');
  }

  return defaults;
}

/**
 * Check whether a request origin matches the allowed origin patterns.
 * Supports exact string matches and *.domain.tld wildcard patterns
 * (restricted to subdomains starting with "citygame" for safety).
 */
export function matchesOrigin(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // e.g. ".vercel.app"
      if (!origin.endsWith(suffix)) return false;
      // Extract the subdomain part and only allow citygame* subdomains
      const url = new URL(origin);
      const hostname = url.hostname;
      const baseDomain = pattern.slice(2); // e.g. "vercel.app"
      const subdomain = hostname.slice(0, hostname.length - baseDomain.length - 1);
      return subdomain.startsWith('citygame');
    }
    return pattern === origin;
  });
}
