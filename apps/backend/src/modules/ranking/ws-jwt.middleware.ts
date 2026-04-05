import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

export interface WsUser {
  id: string;
  email: string;
}

/**
 * Authenticate WebSocket connections using the JWT token from handshake.auth.
 * Attaches the user payload to socket.data.user on success.
 * Disconnects the socket on failure.
 */
export function createWsJwtMiddleware(
  jwtService: JwtService,
  configService: ConfigService,
) {
  const logger = new Logger('WsJwtMiddleware');
  const secret = configService.getOrThrow<string>('JWT_SECRET');

  return (socket: Socket, next: (err?: Error) => void) => {
    const token = (socket.handshake.auth as Record<string, unknown>)?.token as
      | string
      | undefined;

    if (!token) {
      logger.warn(`WS connection rejected: no token (${socket.id})`);
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwtService.verify<{ sub: string; email: string }>(token, {
        secret,
      });

      socket.data.user = {
        id: payload.sub,
        email: payload.email,
      } satisfies WsUser;

      next();
    } catch (error) {
      logger.warn(
        `WS connection rejected: invalid token (${socket.id}) — ${(error as Error).message}`,
      );
      next(new Error('Invalid authentication token'));
    }
  };
}
