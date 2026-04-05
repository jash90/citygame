import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_value'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    passwordHash: 'hashed_password',
    displayName: 'Test User',
    avatarUrl: null,
    role: 'PLAYER',
    pushToken: null,
    refreshToken: 'hashed_refresh',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn()
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token'),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
      get: jest.fn().mockReturnValue('15m'),
    };

    service = new AuthService(prisma, jwtService, configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create user and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'new@test.com',
        password: 'Password1',
        displayName: 'New User',
      });

      expect(result.accessToken).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
      expect(result.user.email).toBe(mockUser.email);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@test.com',
          password: 'Password1',
          displayName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@test.com',
        password: 'Password1',
      });

      expect(result.accessToken).toBe('access_token');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens for valid refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Reset the signAsync mock for this test
      jwtService.signAsync = jest.fn()
        .mockResolvedValueOnce('new_access')
        .mockResolvedValueOnce('new_refresh');

      const result = await service.refreshTokens('user-1', 'valid_token');

      expect(result.accessToken).toBe('new_access');
      expect(result.refreshToken).toBe('new_refresh');
    });

    it('should throw UnauthorizedException when no refresh token stored', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, refreshToken: null });

      await expect(
        service.refreshTokens('user-1', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear refresh token', async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      await service.logout('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: null },
      });
    });
  });

  describe('getMe', () => {
    it('should return user profile without sensitive fields', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        displayName: 'Test',
        avatarUrl: null,
        role: 'PLAYER',
        pushToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getMe('user-1');

      expect(result.id).toBe('user-1');
      expect((result as any).passwordHash).toBeUndefined();
      expect((result as any).refreshToken).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('missing')).rejects.toThrow(UnauthorizedException);
    });
  });
});
