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
export function getAllowedOrigins(
  getEnv: (key: string) => string | undefined,
): string[] {
  const raw = getEnv('CORS_ORIGIN');

  const loopbackDev = [
    // Browser admin
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    // iOS React Native WebSocket sends the target host as Origin on the
    // simulator (e.g. http://127.0.0.1:3001 / http://localhost:3001), so the
    // backend needs to accept its own loopback origin for the WS handshake.
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    // Expo Metro bundler (some RN configs echo this as Origin)
    'http://localhost:8081',
    'http://127.0.0.1:8081',
  ];

  if (raw) {
    const configured = raw.split(',').map((o) => o.trim());
    return [...configured, ...loopbackDev];
  }

  if (getEnv('NODE_ENV') === 'production') {
    // In production, also allow Vercel preview/production deployments
    return [...loopbackDev, '*.vercel.app'];
  }

  return loopbackDev;
}

/**
 * Check whether a request origin matches the allowed origin patterns.
 * Supports exact string matches and *.domain.tld wildcard patterns
 * (restricted to subdomains starting with "citygame" for safety).
 */
export function matchesOrigin(
  origin: string,
  getEnv: (key: string) => string | undefined,
): boolean {
  const allowedOrigins = getAllowedOrigins(getEnv);
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
