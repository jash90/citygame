import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

/**
 * Manages HTTP-only auth cookie operations for web clients (admin panel).
 * Extracted from AuthController to keep the controller focused on HTTP mapping only (SRP).
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Set httpOnly cookies for web clients (admin panel).
   * Mobile clients still use the JSON body tokens.
   */
  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie('accessToken', accessToken, {
      ...this.getCookieOptions('/'),
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      ...this.getCookieOptions('/api/auth'),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie('accessToken', this.getCookieOptions('/'));
    res.clearCookie('refreshToken', this.getCookieOptions('/api/auth'));
  }

  /**
   * Shared cookie options to ensure set and clear use identical attributes.
   * Browsers require sameSite, secure, httpOnly, and path to match when clearing.
   *
   * In production, defaults to SameSite=None + Secure for cross-origin support
   * (admin on Vercel + backend on Railway are different domains).
   * Override with COOKIE_SAME_SITE=lax if running same-origin in production.
   */
  private getCookieOptions(path: string): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'none';
    path: string;
  } {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';
    const envSameSite = this.configService.get<string>('COOKIE_SAME_SITE');

    // Explicit env var takes precedence
    // In production, default to 'none' for cross-origin cookie support.
    // In development, default to 'lax'.
    const sameSite: 'lax' | 'none' =
      envSameSite === 'lax' ? 'lax' :
      envSameSite === 'none' ? 'none' :
      isProduction ? 'none' : 'lax';

    return {
      httpOnly: true,
      secure: isProduction || sameSite === 'none',
      sameSite,
      path,
    };
  }
}
