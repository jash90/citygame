import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  GameStatus,
  RunStatus,
  SessionStatus,
} from '@prisma/client';
import { PlayerService } from './player.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamService } from '../team/team.service';
import { ActivityBroadcastService } from './activity-broadcast.service';

// ── Test helpers ──────────────────────────────────────────────────────────────

const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('game'),
    title: 'Test Game',
    status: GameStatus.PUBLISHED,
    settings: {},
    tasks: [{ id: uid('task'), orderIndex: 0 }],
    runs: [{ id: uid('run'), status: RunStatus.ACTIVE, endsAt: null }],
    ...overrides,
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('sess'),
    gameId: uid('game'),
    userId: uid('user'),
    gameRunId: uid('run'),
    status: SessionStatus.ACTIVE,
    totalPoints: 0,
    currentTaskId: uid('task'),
    startedAt: new Date(),
    completedAt: null,
    teamId: null,
    ...overrides,
  };
}

// ── Mock factories ────────────────────────────────────────────────────────────

const mockPrisma: Record<string, any> = {
  game: { findUnique: jest.fn() },
  gameRun: { findFirst: jest.fn() },
  gameSession: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  task: { count: jest.fn() },
  taskAttempt: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  teamMember: { findMany: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockTeamService = {
  findMembership: jest.fn(),
};

const mockActivityBroadcast = {
  handlePostCorrect: jest.fn().mockResolvedValue(undefined),
  broadcastJoinActivity: jest.fn().mockResolvedValue(undefined),
  broadcastHintActivity: jest.fn().mockResolvedValue(undefined),
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TeamService, useValue: mockTeamService },
        { provide: ActivityBroadcastService, useValue: mockActivityBroadcast },
      ],
    }).compile();

    service = module.get(PlayerService);
  });

  // ── startGame ───────────────────────────────────────────────────────────

  describe('startGame', () => {
    it('creates a new session for a published game with active run', async () => {
      const game = makeGame();
      const session = makeSession({
        gameId: game.id,
        gameRunId: game.runs[0].id,
        currentTaskId: game.tasks[0].id,
      });

      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);
      mockPrisma.gameSession.create.mockResolvedValue(session);
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Test' });

      const result = await service.startGame(game.id, session.userId);

      expect(result).toEqual(session);
      expect(mockPrisma.gameSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gameId: game.id,
            gameRunId: game.runs[0].id,
            status: SessionStatus.ACTIVE,
            currentTaskId: game.tasks[0].id,
          }),
        }),
      );
    });

    it('returns existing active session (idempotent)', async () => {
      const game = makeGame();
      const existing = makeSession({ status: SessionStatus.ACTIVE });

      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.gameSession.findUnique.mockResolvedValue(existing);

      const result = await service.startGame(game.id, existing.userId);
      expect(result).toEqual(existing);
      expect(mockPrisma.gameSession.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException if session exists but is not active', async () => {
      const game = makeGame();
      const completed = makeSession({ status: SessionStatus.COMPLETED });

      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.gameSession.findUnique.mockResolvedValue(completed);

      await expect(service.startGame(game.id, completed.userId))
        .rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for non-existent game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(service.startGame('no-game', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if game is not published', async () => {
      const game = makeGame({ status: GameStatus.DRAFT });
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(service.startGame(game.id, 'user-1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if no active run', async () => {
      const game = makeGame({ runs: [] });
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(service.startGame(game.id, 'user-1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if run has expired', async () => {
      const game = makeGame({
        runs: [{ id: 'run-1', status: RunStatus.ACTIVE, endsAt: new Date('2020-01-01') }],
      });
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(service.startGame(game.id, 'user-1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('delegates to team flow when teamMode enabled', async () => {
      const game = makeGame({ settings: { teamMode: true } });
      const session = makeSession({ teamId: 'team-1' });

      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockTeamService.findMembership.mockResolvedValue({ teamId: 'team-1' });
      mockPrisma.gameSession.findFirst.mockResolvedValue(null);
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);
      mockPrisma.gameSession.create.mockResolvedValue(session);
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Test' });

      const result = await service.startGame(game.id, session.userId);
      expect(result).toEqual(session);
      expect(mockTeamService.findMembership).toHaveBeenCalled();
    });

    it('throws BadRequestException in team mode if user has no team', async () => {
      const game = makeGame({ settings: { teamMode: true } });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockTeamService.findMembership.mockResolvedValue(null);

      await expect(service.startGame(game.id, 'user-1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // NOTE: getProgress, getMyActiveSession tests moved to PlayerQueryService spec
  // NOTE: getRunAnswers tests moved to PlayerQueryService spec
});
