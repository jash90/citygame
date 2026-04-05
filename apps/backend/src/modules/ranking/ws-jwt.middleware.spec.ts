import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createWsJwtMiddleware } from './ws-jwt.middleware';

describe('WsJwtMiddleware', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  const middleware = createWsJwtMiddleware(jwtService, configService);

  function makeSocket(token?: string) {
    return {
      id: 'socket-1',
      handshake: {
        auth: token ? { token } : {},
      },
      data: {},
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  it('rejects connection with no token', () => {
    const socket = makeSocket();
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe('Authentication required');
  });

  it('rejects connection with invalid token', () => {
    const socket = makeSocket('invalid-jwt-token');
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe('Invalid authentication token');
  });

  it('authenticates with valid token', () => {
    const token = jwtService.sign({ sub: 'user-1', email: 'test@test.com' }, { secret: 'test-secret' });
    const socket = makeSocket(token);
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith(); // no error
    expect(socket.data.user).toEqual({
      id: 'user-1',
      email: 'test@test.com',
    });
  });

  it('rejects expired token', () => {
    const token = jwtService.sign(
      { sub: 'user-1', email: 'test@test.com' },
      { secret: 'test-secret', expiresIn: '0s' },
    );

    // Wait a moment so the token expires
    const socket = makeSocket(token);
    const next = jest.fn();

    // Token with 0s expiry is already expired
    middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
