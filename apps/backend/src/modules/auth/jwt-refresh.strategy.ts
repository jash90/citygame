import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './jwt.strategy';

/**
 * Extract the refresh JWT from:
 * 1. Body field `refreshToken` (mobile clients)
 * 2. httpOnly cookie `refreshToken` (admin panel)
 */
function extractRefreshToken(req: Request): string | null {
  // Try body first (mobile)
  const fromBody = ExtractJwt.fromBodyField('refreshToken')(req);
  if (fromBody) return fromBody;

  // Fall back to httpOnly cookie (admin)
  const cookieToken = req.cookies?.refreshToken as string | undefined;
  return cookieToken ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: extractRefreshToken,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, refreshToken: true },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
