import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  game: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  gameSession: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  task: { count: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('1.0.0'),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fnOrArray: unknown) => {
        if (typeof fnOrArray === 'function') {
          return (fnOrArray as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
        }
        return Promise.all(fnOrArray as Promise<unknown>[]);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('listUsers', () => {
    it('returns paginated users', async () => {
      const users = [
        { id: 'u1', email: 'a@b.com', displayName: 'A', role: UserRole.PLAYER, createdAt: new Date() },
      ];
      mockPrisma.$transaction.mockResolvedValue([users, 1]);

      const result = await service.listUsers({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by role', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.listUsers({ role: UserRole.ADMIN });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('filters by search term', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.listUsers({ search: 'john' });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('updateUserRole', () => {
    it('updates user role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: UserRole.PLAYER,
      });
      const updated = { id: 'u1', role: UserRole.ADMIN, email: 'a@b.com', displayName: 'A' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateUserRole('u1', UserRole.ADMIN, 'admin-1');

      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('throws BadRequestException when changing own role', async () => {
      await expect(service.updateUserRole('admin-1', UserRole.PLAYER, 'admin-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserRole('no-user', UserRole.ADMIN, 'admin-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('prevents demoting the last admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: UserRole.ADMIN,
      });
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(service.updateUserRole('u1', UserRole.PLAYER, 'admin-2'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getSystemInfo', () => {
    it('returns system info with db healthy', async () => {
      mockPrisma.$transaction.mockResolvedValue([10, 5, 50, 3]);
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getSystemInfo();

      expect(result.userCount).toBe(10);
      expect(result.gameCount).toBe(5);
      expect(result.sessionCount).toBe(50);
      expect(result.activeSessionCount).toBe(3);
      expect(result.dbHealthy).toBe(true);
    });

    it('reports dbHealthy false on query failure', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, 0, 0, 0]);
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));

      const result = await service.getSystemInfo();
      expect(result.dbHealthy).toBe(false);
    });
  });

  describe('getDashboardStats', () => {
    it('returns dashboard statistics', async () => {
      mockPrisma.$transaction.mockResolvedValue([5, 100, 30, 8]);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        activeGames: 5,
        totalPlayers: 100,
        totalTasks: 30,
        activeSessions: 8,
      });
    });
  });
});
