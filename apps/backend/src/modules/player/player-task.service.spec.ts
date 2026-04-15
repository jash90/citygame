import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  AttemptStatus,
  RunStatus,
  SessionStatus,
  TaskType,
  UnlockMethod,
} from '@prisma/client';
import { PlayerTaskService } from './player-task.service';
import { PlayerHintService } from './player-hint.service';
// PlayerService is tested separately
import { PrismaService } from '../../prisma/prisma.service';
import { VerificationService } from '../task/verification/verification.service';
import { RankingGateway } from '../ranking/ranking.gateway';
import { TeamService } from '../team/team.service';
import { ActivityBroadcastService } from './activity-broadcast.service';

// ── Test helpers ──────────────────────────────────────────────────────────────

const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

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

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('task'),
    gameId: uid('game'),
    title: 'Task 1',
    description: 'Do something',
    type: TaskType.TEXT_EXACT,
    unlockMethod: UnlockMethod.GPS,
    orderIndex: 0,
    latitude: 52.23,
    longitude: 21.01,
    unlockConfig: { radiusMeters: 50 },
    verifyConfig: { type: 'TEXT_EXACT', answerHash: 'abc' },
    maxPoints: 100,
    timeLimitSec: null,
    storyContext: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Mock factories ────────────────────────────────────────────────────────────

const mockPrisma: Record<string, any> = {
  gameRun: { findFirst: jest.fn() },
  gameSession: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  task: { findFirst: jest.fn(), count: jest.fn() },
  taskAttempt: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
  hintUsage: { findMany: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockVerification = { verify: jest.fn() };

const mockGateway = {
  broadcastRankingUpdate: jest.fn(),
  broadcastPlayerCompletedTask: jest.fn(),
  broadcastAiResult: jest.fn(),
  broadcastActivity: jest.fn(),
  broadcastTeamUpdate: jest.fn(),
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

describe('PlayerTaskService', () => {
  let service: PlayerTaskService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerTaskService,
        PlayerHintService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VerificationService, useValue: mockVerification },
        { provide: RankingGateway, useValue: mockGateway },
        { provide: TeamService, useValue: mockTeamService },
        { provide: ActivityBroadcastService, useValue: mockActivityBroadcast },
      ],
    }).compile();

    service = module.get(PlayerTaskService);
  });

  // ── unlockTask ──────────────────────────────────────────────────────────

  describe('unlockTask', () => {
    const gameId = 'game-1';
    const userId = 'user-1';

    beforeEach(() => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ id: 'run-1', status: RunStatus.ACTIVE, endsAt: null });
      mockPrisma.gameSession.findUnique.mockResolvedValue(makeSession());
    });

    it('unlocks with GPS when within radius', async () => {
      const task = makeTask({
        gameId,
        unlockMethod: UnlockMethod.GPS,
        latitude: 52.2297,
        longitude: 21.0122,
        unlockConfig: { radiusMeters: 100 },
      });
      mockPrisma.task.findFirst.mockResolvedValue(task);

      const result = await service.unlockTask(gameId, task.id, userId, {
        latitude: 52.2297,
        longitude: 21.0122,
      });

      expect(result.unlocked).toBe(true);
    });

    it('rejects GPS unlock when outside radius', async () => {
      const task = makeTask({
        gameId,
        unlockMethod: UnlockMethod.GPS,
        latitude: 52.2297,
        longitude: 21.0122,
        unlockConfig: { radiusMeters: 10 },
      });
      mockPrisma.task.findFirst.mockResolvedValue(task);

      const result = await service.unlockTask(gameId, task.id, userId, {
        latitude: 52.0,
        longitude: 21.0,
      });

      expect(result.unlocked).toBe(false);
    });

    it('rejects GPS unlock without coordinates', async () => {
      const task = makeTask({
        gameId,
        unlockMethod: UnlockMethod.GPS,
        unlockConfig: { radiusMeters: 50 },
      });
      mockPrisma.task.findFirst.mockResolvedValue(task);

      const result = await service.unlockTask(gameId, task.id, userId, {});
      expect(result.unlocked).toBe(false);
    });

    it('unlocks with QR when code matches', async () => {
      const task = makeTask({
        gameId,
        unlockMethod: UnlockMethod.QR,
        unlockConfig: { qrCode: 'secret-123' },
      });
      mockPrisma.task.findFirst.mockResolvedValue(task);

      const result = await service.unlockTask(gameId, task.id, userId, {
        code: 'secret-123',
      });

      expect(result.unlocked).toBe(true);
    });

    it('rejects QR unlock with wrong code', async () => {
      const task = makeTask({
        gameId,
        unlockMethod: UnlockMethod.QR,
        unlockConfig: { qrCode: 'secret-123' },
      });
      mockPrisma.task.findFirst.mockResolvedValue(task);

      const result = await service.unlockTask(gameId, task.id, userId, {
        code: 'wrong-code',
      });

      expect(result.unlocked).toBe(false);
    });

    it('throws NotFoundException for non-existent task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      await expect(service.unlockTask(gameId, 'no-task', userId, {}))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── submitAnswer ────────────────────────────────────────────────────────

  describe('submitAnswer', () => {
    const gameId = 'game-1';
    const userId = 'user-1';
    const runId = 'run-1';
    const sessionId = 'sess-1';

    beforeEach(() => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ id: runId, status: RunStatus.ACTIVE, endsAt: null });
      mockPrisma.gameSession.findUnique.mockResolvedValue(
        makeSession({ id: sessionId, gameId, userId, gameRunId: runId }),
      );
      mockPrisma.taskAttempt.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Player', pushToken: null });
    });

    it('awards full points for a CORRECT answer', async () => {
      const task = makeTask({ gameId, maxPoints: 100, orderIndex: 0 });
      mockPrisma.task.findFirst.mockResolvedValue(task);
      mockVerification.verify.mockResolvedValue({ status: 'CORRECT', score: 1.0 });

      const attempt = {
        id: 'att-1',
        status: AttemptStatus.CORRECT,
        pointsAwarded: 100,
      };
      mockPrisma.taskAttempt.create.mockResolvedValue(attempt);
      mockPrisma.gameSession.update.mockResolvedValue({ id: sessionId, totalPoints: 100, teamId: null });
      mockPrisma.task.findFirst
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(null);

      const result = await service.submitAnswer(gameId, task.id, userId, { answer: 'correct' });

      expect(result.status).toBe(AttemptStatus.CORRECT);
      expect(result.pointsAwarded).toBe(100);
    });

    it('awards zero points for an INCORRECT answer', async () => {
      const task = makeTask({ gameId, maxPoints: 100 });
      mockPrisma.task.findFirst.mockResolvedValue(task);
      mockVerification.verify.mockResolvedValue({ status: 'INCORRECT', score: 0 });

      const attempt = {
        id: 'att-2',
        status: AttemptStatus.INCORRECT,
        pointsAwarded: 0,
      };
      mockPrisma.taskAttempt.create.mockResolvedValue(attempt);

      const result = await service.submitAnswer(gameId, task.id, userId, { answer: 'wrong' });

      expect(result.status).toBe(AttemptStatus.INCORRECT);
      expect(result.pointsAwarded).toBe(0);
    });

    it('awards partial points for PARTIAL answers', async () => {
      const task = makeTask({ gameId, maxPoints: 100 });
      mockPrisma.task.findFirst.mockResolvedValue(task);
      mockVerification.verify.mockResolvedValue({ status: 'PARTIAL', score: 0.7 });

      const attempt = {
        id: 'att-3',
        status: AttemptStatus.PARTIAL,
        pointsAwarded: 70,
      };
      mockPrisma.taskAttempt.create.mockResolvedValue(attempt);
      mockPrisma.gameSession.update.mockResolvedValue({ id: sessionId, totalPoints: 70, teamId: null });

      const result = await service.submitAnswer(gameId, task.id, userId, { answer: 'partial' });

      expect(result.status).toBe(AttemptStatus.PARTIAL);
      expect(result.pointsAwarded).toBe(70);
    });

    it('broadcasts AI result for AI task types', async () => {
      const task = makeTask({ gameId, type: TaskType.PHOTO_AI, maxPoints: 100 });
      mockPrisma.task.findFirst.mockResolvedValue(task);
      mockVerification.verify.mockResolvedValue({
        status: 'CORRECT',
        score: 1.0,
        feedback: 'Great photo!',
      });

      const attempt = { id: 'att-4', status: AttemptStatus.CORRECT, pointsAwarded: 100 };
      mockPrisma.taskAttempt.create.mockResolvedValue(attempt);
      mockPrisma.gameSession.update.mockResolvedValue({ id: sessionId, totalPoints: 100, teamId: null });

      await service.submitAnswer(gameId, task.id, userId, { imageUrl: 'http://img.jpg' });

      expect(mockGateway.broadcastAiResult).toHaveBeenCalledWith(
        gameId,
        expect.objectContaining({ attemptId: 'att-4', userId, status: 'CORRECT' }),
      );
    });

    it('throws NotFoundException for non-existent task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      await expect(service.submitAnswer(gameId, 'no-task', userId, {}))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when no active run', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue(null);

      await expect(service.submitAnswer(gameId, 'task-1', userId, {}))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when run has expired', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({
        id: runId,
        status: RunStatus.ACTIVE,
        endsAt: new Date('2020-01-01'),
      });
      mockPrisma.gameSession.findUnique.mockResolvedValue(
        makeSession({ id: sessionId, status: SessionStatus.ACTIVE }),
      );
      mockPrisma.gameSession.update.mockResolvedValue({});

      await expect(service.submitAnswer(gameId, 'task-1', userId, {}))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── useHint ─────────────────────────────────────────────────────────────

  describe('useHint', () => {
    const gameId = 'game-1';
    const userId = 'user-1';

    beforeEach(() => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ id: 'run-1', status: RunStatus.ACTIVE, endsAt: null });
      mockPrisma.gameSession.findUnique.mockResolvedValue(makeSession({ id: 'sess-1' }));
    });

    it('returns the next unused hint and applies penalty', async () => {
      const hints = [
        { id: 'h1', orderIndex: 0, content: 'Hint 1', pointPenalty: 10 },
        { id: 'h2', orderIndex: 1, content: 'Hint 2', pointPenalty: 20 },
      ];
      const task = makeTask({ gameId, hints });
      mockPrisma.task.findFirst.mockResolvedValue(task);
      mockPrisma.hintUsage.findMany.mockResolvedValue([]);
      mockPrisma.hintUsage.create.mockResolvedValue({});
      mockPrisma.gameSession.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Player' });

      const result = await service.useHint(gameId, task.id, userId);

      expect(result.hint.content).toBe('Hint 1');
      expect(result.hint.pointPenalty).toBe(10);
    });

    it('skips already used hints', async () => {
      const hints = [
        { id: 'h1', orderIndex: 0, content: 'Hint 1', pointPenalty: 10 },
        { id: 'h2', orderIndex: 1, content: 'Hint 2', pointPenalty: 20 },
      ];
      const task = makeTask({ gameId, hints });
      mockPrisma.task.findFirst.mockResolvedValue(task);
      mockPrisma.hintUsage.findMany.mockResolvedValue([{ hintId: 'h1' }]);
      mockPrisma.hintUsage.create.mockResolvedValue({});
      mockPrisma.gameSession.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Player' });

      const result = await service.useHint(gameId, task.id, userId);

      expect(result.hint.content).toBe('Hint 2');
    });

    it('throws BadRequestException when all hints used', async () => {
      const hints = [{ id: 'h1', orderIndex: 0, content: 'Hint 1', pointPenalty: 10 }];
      const task = makeTask({ gameId, hints });
      mockPrisma.task.findFirst.mockResolvedValue(task);
      mockPrisma.hintUsage.findMany.mockResolvedValue([{ hintId: 'h1' }]);

      await expect(service.useHint(gameId, task.id, userId))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when task has no hints', async () => {
      const task = makeTask({ gameId, hints: [] });
      mockPrisma.task.findFirst.mockResolvedValue(task);

      await expect(service.useHint(gameId, task.id, userId))
        .rejects.toThrow(BadRequestException);
    });
  });
});
