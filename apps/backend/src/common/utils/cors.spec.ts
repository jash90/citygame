import { matchesOrigin, getAllowedOrigins } from './cors';

describe('CORS utils', () => {
  const originalEnv = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CORS_ORIGIN = originalEnv;
    } else {
      delete process.env.CORS_ORIGIN;
    }
  });

  describe('getAllowedOrigins', () => {
    it('parses comma-separated origins', () => {
      process.env.CORS_ORIGIN = 'http://a.com, http://b.com';
      expect(getAllowedOrigins()).toEqual(['http://a.com', 'http://b.com']);
    });

    it('returns defaults when env is unset', () => {
      delete process.env.CORS_ORIGIN;
      expect(getAllowedOrigins()).toEqual([
        'http://localhost:3000',
        'http://localhost:3002',
      ]);
    });
  });

  describe('matchesOrigin', () => {
    it('matches exact origin', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      expect(matchesOrigin('http://localhost:3000')).toBe(true);
    });

    it('rejects non-matching origin', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      expect(matchesOrigin('http://evil.com')).toBe(false);
    });

    it('matches wildcard pattern for citygame subdomain', () => {
      process.env.CORS_ORIGIN = '*.vercel.app';
      expect(matchesOrigin('https://citygame-admin.vercel.app')).toBe(true);
    });

    it('matches wildcard for citygame preview deploy', () => {
      process.env.CORS_ORIGIN = '*.vercel.app';
      expect(matchesOrigin('https://citygame-abc123.vercel.app')).toBe(true);
    });

    it('rejects wildcard for non-citygame subdomain', () => {
      process.env.CORS_ORIGIN = '*.vercel.app';
      expect(matchesOrigin('https://evil-app.vercel.app')).toBe(false);
    });

    it('supports multiple comma-separated origins', () => {
      process.env.CORS_ORIGIN =
        'http://localhost:3000,https://citygame.vercel.app';
      expect(matchesOrigin('https://citygame.vercel.app')).toBe(true);
      expect(matchesOrigin('http://localhost:3000')).toBe(true);
      expect(matchesOrigin('http://other.com')).toBe(false);
    });

    it('handles mixed exact and wildcard patterns', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000,*.vercel.app';
      expect(matchesOrigin('http://localhost:3000')).toBe(true);
      expect(matchesOrigin('https://citygame-admin.vercel.app')).toBe(true);
      expect(matchesOrigin('https://evil.vercel.app')).toBe(false);
    });
  });
});
