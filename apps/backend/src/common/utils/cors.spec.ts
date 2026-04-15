import { matchesOrigin, getAllowedOrigins } from './cors';

const envFromRecord = (env: Record<string, string | undefined>) =>
  (key: string) => env[key];

describe('CORS utils', () => {
  describe('getAllowedOrigins', () => {
    it('parses comma-separated origins', () => {
      const getEnv = envFromRecord({ CORS_ORIGIN: 'http://a.com, http://b.com' });
      expect(getAllowedOrigins(getEnv)).toEqual(['http://a.com', 'http://b.com']);
    });

    it('returns defaults when env is unset', () => {
      const getEnv = envFromRecord({});
      expect(getAllowedOrigins(getEnv)).toEqual([
        'http://localhost:3000',
        'http://localhost:3002',
      ]);
    });

    it('includes vercel wildcard in production', () => {
      const getEnv = envFromRecord({ NODE_ENV: 'production' });
      expect(getAllowedOrigins(getEnv)).toContain('*.vercel.app');
    });
  });

  describe('matchesOrigin', () => {
    it('matches exact origin', () => {
      const getEnv = envFromRecord({ CORS_ORIGIN: 'http://localhost:3000' });
      expect(matchesOrigin('http://localhost:3000', getEnv)).toBe(true);
    });

    it('rejects non-matching origin', () => {
      const getEnv = envFromRecord({ CORS_ORIGIN: 'http://localhost:3000' });
      expect(matchesOrigin('http://evil.com', getEnv)).toBe(false);
    });

    it('matches wildcard pattern for citygame subdomain', () => {
      const getEnv = envFromRecord({ CORS_ORIGIN: '*.vercel.app' });
      expect(matchesOrigin('https://citygame-admin.vercel.app', getEnv)).toBe(true);
    });

    it('matches wildcard for citygame preview deploy', () => {
      const getEnv = envFromRecord({ CORS_ORIGIN: '*.vercel.app' });
      expect(matchesOrigin('https://citygame-abc123.vercel.app', getEnv)).toBe(true);
    });

    it('rejects wildcard for non-citygame subdomain', () => {
      const getEnv = envFromRecord({ CORS_ORIGIN: '*.vercel.app' });
      expect(matchesOrigin('https://evil-app.vercel.app', getEnv)).toBe(false);
    });

    it('supports multiple comma-separated origins', () => {
      const getEnv = envFromRecord({
        CORS_ORIGIN: 'http://localhost:3000,https://citygame.vercel.app',
      });
      expect(matchesOrigin('https://citygame.vercel.app', getEnv)).toBe(true);
      expect(matchesOrigin('http://localhost:3000', getEnv)).toBe(true);
      expect(matchesOrigin('http://other.com', getEnv)).toBe(false);
    });

    it('handles mixed exact and wildcard patterns', () => {
      const getEnv = envFromRecord({ CORS_ORIGIN: 'http://localhost:3000,*.vercel.app' });
      expect(matchesOrigin('http://localhost:3000', getEnv)).toBe(true);
      expect(matchesOrigin('https://citygame-admin.vercel.app', getEnv)).toBe(true);
      expect(matchesOrigin('https://evil.vercel.app', getEnv)).toBe(false);
    });
  });
});
