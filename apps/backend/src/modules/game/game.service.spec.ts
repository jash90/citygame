import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GameStatus } from '@prisma/client';
import { GameService } from './game.service';
import { PrismaService } from '../../prisma/prisma.service';

// ── Test helpers ──────────────────────────────────────────────────────────────

const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('game'),
    title: 'Test Game',
    description: 'A game',
    city: 'Warsaw',
    coverImageUrl: null,
    status: GameStatus.DRAFT,
    settings: {},
    creatorId: 'creator-1',
    currentRun: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { id: 'creator-1', displayName: 'Creator' },
    runs: [],
    _count: { tasks: 3, sessions: 10 },
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  game: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  gameRun: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gameSession: {
    count: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  taskAttempt: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  hintUsage: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default $transaction: run callback with mockPrisma
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
        GameService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(GameService);
  });

  // ── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated games with counts', async () => {
      const games = [makeGame(), makeGame()];
      mockPrisma.$transaction.mockResolvedValue([games, 2]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      // Flat counts should be mapped
      expect(result.items[0]).toHaveProperty('taskCount');
      expect(result.items[0]).toHaveProperty('playerCount');
    });

    it('filters by city when provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({ city: 'Krakow' });

      // Verify the transaction was called (findMany + count)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns game with task/player counts', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);

      const result = await service.findOne(game.id);

      expect(result.taskCount).toBe(3);
      expect(result.playerCount).toBe(10);
    });

    it('throws NotFoundException for non-existent game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-game')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a game with DRAFT status', async () => {
      const created = makeGame();
      mockPrisma.game.create.mockResolvedValue(created);

      const result = await service.create(
        { title: 'New', description: 'A test game description', city: 'Warsaw', settings: {} } as any,
        'creator-1',
      );

      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: GameStatus.DRAFT }),
        }),
      );
      expect(result).toEqual(created);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates game fields', async () => {
      const game = makeGame({ creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      const updated = { ...game, title: 'Updated' };
      mockPrisma.game.update.mockResolvedValue(updated);

      const result = await service.update(
        game.id,
        { title: 'Updated' },
        'creator-1',
        false,
      );

      expect(result.title).toBe('Updated');
    });

    it('throws ForbiddenException if not owner and not admin', async () => {
      const game = makeGame({ creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(
        service.update(game.id, { title: 'X' }, 'other-user', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to update any game', async () => {
      const game = makeGame({ creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.update.mockResolvedValue({ ...game, title: 'Admin Edit' });

      const result = await service.update(game.id, { title: 'Admin Edit' }, 'admin-1', true);
      expect(result.title).toBe('Admin Edit');
    });
  });

  // ── publish ─────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('transitions DRAFT → PUBLISHED', async () => {
      const game = makeGame({ status: GameStatus.DRAFT, creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.update.mockResolvedValue({
        ...game,
        status: GameStatus.PUBLISHED,
      });

      const result = await service.publish(game.id, 'creator-1', false);
      expect(result.status).toBe(GameStatus.PUBLISHED);
    });

    it('throws ForbiddenException if already published', async () => {
      const game = makeGame({ status: GameStatus.PUBLISHED, creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(service.publish(game.id, 'creator-1', false))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── archive ─────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('transitions to ARCHIVED', async () => {
      const game = makeGame({ status: GameStatus.PUBLISHED, creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.update.mockResolvedValue({
        ...game,
        status: GameStatus.ARCHIVED,
      });

      const result = await service.archive(game.id, 'creator-1', false);
      expect(result.status).toBe(GameStatus.ARCHIVED);
    });

    it('throws ForbiddenException if already archived', async () => {
      const game = makeGame({ status: GameStatus.ARCHIVED, creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(service.archive(game.id, 'creator-1', false))
        .rejects.toThrow(ForbiddenException);
    });
  });


  // NOTE: startRun/endRun tests moved to game-run.service.spec.ts
  // NOTE: getGameStats tests moved to game-analytics.service.spec.ts


  describe('delete', () => {
    it('deletes a game with no sessions', async () => {
      const game = makeGame({ creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.gameSession.count.mockResolvedValue(0);
      mockPrisma.game.delete.mockResolvedValue(game);

      await expect(service.delete(game.id, 'creator-1', false)).resolves.not.toThrow();
    });

    it('throws BadRequestException when sessions exist', async () => {
      const game = makeGame({ creatorId: 'creator-1' });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.gameSession.count.mockResolvedValue(5);

      await expect(service.delete(game.id, 'creator-1', false))
        .rejects.toThrow(BadRequestException);
    });
  });

});
