import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { GameStatus, RunStatus, SessionStatus } from '@prisma/client';
import { GameRunService } from './game-run.service';
import { GameService } from './game.service';
import { PrismaService } from '../../prisma/prisma.service';

const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('game'),
    title: 'Test Game',
    description: 'A game',
    city: 'Warsaw',
    coverImageUrl: null,
    status: GameStatus.PUBLISHED,
    settings: {},
    creatorId: 'creator-1',
    currentRun: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    taskCount: 3,
    playerCount: 0,
    activeRun: null,
    creator: { id: 'creator-1', displayName: 'Admin' },
    ...overrides,
  };
}

 
const mockPrisma: Record<string, any> = {
  game: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  gameRun: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gameSession: {
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  taskAttempt: { groupBy: jest.fn() },
  hintUsage: { findMany: jest.fn() },
  $transaction: jest.fn((fn: unknown) => {
    if (typeof fn === 'function') {
      return (fn as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(fn as Promise<unknown>[]);
  }),
};

const mockGameService = {
  findOne: jest.fn(),
};

describe('GameRunService', () => {
  let service: GameRunService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameRunService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GameService, useValue: mockGameService },
      ],
    }).compile();

    service = module.get(GameRunService);
  });

  describe('startRun', () => {
    it('creates a new run and increments currentRun', async () => {
      const game = makeGame({ currentRun: 0 });
      mockGameService.findOne.mockResolvedValue(game);
      mockPrisma.gameRun.findFirst.mockResolvedValue(null);

      const newRun = {
        id: 'run-1',
        gameId: game.id,
        runNumber: 1,
        status: RunStatus.ACTIVE,
        endsAt: null,
      };
      mockPrisma.gameRun.create.mockResolvedValue(newRun);
      mockPrisma.game.update.mockResolvedValue({ ...game, currentRun: 1 });

      const result = await service.startRun(game.id, 'creator-1', false);

      expect(result.runNumber).toBe(1);
      expect(result.status).toBe(RunStatus.ACTIVE);
    });

    it('sets endsAt based on timeLimitMinutes', async () => {
      const game = makeGame({ settings: { timeLimitMinutes: 60 } });
      mockGameService.findOne.mockResolvedValue(game);
      mockPrisma.gameRun.findFirst.mockResolvedValue(null);

      const runWithExpiry = {
        id: 'run-2',
        runNumber: 1,
        status: RunStatus.ACTIVE,
        endsAt: new Date(Date.now() + 60 * 60_000),
      };
      mockPrisma.gameRun.create.mockResolvedValue(runWithExpiry);
      mockPrisma.game.update.mockResolvedValue({});

      const result = await service.startRun(game.id, 'creator-1', false);
      expect(result.endsAt).toBeTruthy();
    });

    it('throws BadRequestException if active run already exists', async () => {
      const game = makeGame();
      mockGameService.findOne.mockResolvedValue(game);
      mockPrisma.gameRun.findFirst.mockResolvedValue({ id: 'existing-run' });

      await expect(service.startRun(game.id, 'creator-1', false))
        .rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for non-PUBLISHED game', async () => {
      const game = makeGame({ status: GameStatus.DRAFT });
      mockGameService.findOne.mockResolvedValue(game);

      await expect(service.startRun(game.id, 'creator-1', false))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if not owner and not admin', async () => {
      const game = makeGame({ creatorId: 'other-user' });
      mockGameService.findOne.mockResolvedValue(game);

      await expect(service.startRun(game.id, 'creator-1', false))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('endRun', () => {
    it('ends the active run and times out active sessions', async () => {
      const game = makeGame({ creatorId: 'creator-1' });
      mockGameService.findOne.mockResolvedValue(game);

      const activeRun = { id: 'run-1', status: RunStatus.ACTIVE };
      mockPrisma.gameRun.findFirst.mockResolvedValue(activeRun);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 5 });

      const endedRun = { ...activeRun, status: RunStatus.ENDED, endedAt: new Date() };
      mockPrisma.gameRun.update.mockResolvedValue(endedRun);

      const result = await service.endRun(game.id, 'creator-1', false);

      expect(result.status).toBe(RunStatus.ENDED);
      expect(mockPrisma.gameSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: SessionStatus.ACTIVE }),
          data: expect.objectContaining({ status: SessionStatus.TIMED_OUT }),
        }),
      );
    });

    it('throws BadRequestException when no active run', async () => {
      const game = makeGame({ creatorId: 'creator-1' });
      mockGameService.findOne.mockResolvedValue(game);
      mockPrisma.gameRun.findFirst.mockResolvedValue(null);

      await expect(service.endRun(game.id, 'creator-1', false))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getRunHistory', () => {
    it('returns runs ordered by runNumber desc', async () => {
      const gameId = uid('game');
      mockGameService.findOne.mockResolvedValue(makeGame({ id: gameId }));
      const runs = [
        { id: 'r2', runNumber: 2, _count: { sessions: 5 } },
        { id: 'r1', runNumber: 1, _count: { sessions: 10 } },
      ];
      mockPrisma.gameRun.findMany.mockResolvedValue(runs);

      const result = await service.getRunHistory(gameId);

      expect(result).toHaveLength(2);
      expect(result[0].runNumber).toBe(2);
    });
  });

  // NOTE: getRunActivity tests moved to GameRunActivityService spec

  describe('getRunningGames', () => {
    it('returns games with active runs', async () => {
      mockPrisma.game.findMany.mockResolvedValue([
        {
          id: 'g1',
          title: 'Running Game',
          creator: { id: 'c1', displayName: 'Admin' },
          runs: [{ id: 'r1', status: RunStatus.ACTIVE }],
          _count: { tasks: 3, sessions: 10 },
        },
      ]);

      const result = await service.getRunningGames();

      expect(result).toHaveLength(1);
      expect(result[0].taskCount).toBe(3);
      expect(result[0].playerCount).toBe(10);
      expect(result[0].activeRun).toBeTruthy();
    });
  });
});
