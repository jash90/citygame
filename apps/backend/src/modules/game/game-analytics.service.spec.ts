import { Test, TestingModule } from '@nestjs/testing';
import { AttemptStatus, RunStatus, SessionStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { GameAnalyticsService } from './game-analytics.service';
import { GameService } from './game.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: Record<string, any> = {
  gameSession: { groupBy: jest.fn() },
  gameRun: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  taskAttempt: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  task: { findMany: jest.fn() },
  $transaction: jest.fn((fnOrArray: unknown) => {
    if (typeof fnOrArray === 'function') {
      return (fnOrArray as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(fnOrArray as Promise<unknown>[]);
  }),
};

const mockGameService = {
  findOne: jest.fn().mockResolvedValue({ id: 'game-1' }),
};

describe('GameAnalyticsService', () => {
  let service: GameAnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGameService.findOne.mockResolvedValue({ id: 'game-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GameService, useValue: mockGameService },
      ],
    }).compile();

    service = module.get(GameAnalyticsService);
  });

  describe('getGameStats', () => {
    it('returns aggregated statistics', async () => {
      mockPrisma.gameSession.groupBy.mockResolvedValue([
        { status: SessionStatus.ACTIVE, _count: 3 },
        { status: SessionStatus.COMPLETED, _count: 7 },
      ]);
      mockPrisma.taskAttempt.count.mockResolvedValue(15);
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Task 2' },
      ]);
      // First groupBy for correct attempts, second for all attempts
      mockPrisma.taskAttempt.groupBy
        .mockResolvedValueOnce([{ taskId: 't1', _count: 5 }])
        .mockResolvedValueOnce([
          { taskId: 't1', _count: 10 },
          { taskId: 't2', _count: 5 },
        ]);

      const result = await service.getGameStats('game-1');

      expect(result.totalSessions).toBe(10);
      expect(result.activeSessions).toBe(3);
      expect(result.completedSessions).toBe(7);
      expect(result.totalAttempts).toBe(15);
      expect(result.taskCompletionRates).toHaveLength(2);
    });

    it('returns zero completion rate when no tasks', async () => {
      mockPrisma.gameSession.groupBy.mockResolvedValue([]);
      mockPrisma.taskAttempt.count.mockResolvedValue(0);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.taskAttempt.groupBy.mockResolvedValue([]);

      const result = await service.getGameStats('game-1');

      expect(result.totalSessions).toBe(0);
      expect(result.avgCompletionRate).toBe(0);
    });
  });

  describe('getTaskDifficultyStats', () => {
    it('returns average attempts per task', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't1', title: 'Task 1' },
      ]);
      mockPrisma.taskAttempt.findMany.mockResolvedValue([
        { taskId: 't1', sessionId: 's1' },
        { taskId: 't1', sessionId: 's1' },
        { taskId: 't1', sessionId: 's2' },
      ]);

      const result = await service.getTaskDifficultyStats('game-1');

      expect(result).toHaveLength(1);
      expect(result[0].taskTitle).toBe('Task 1');
      expect(result[0].avgAttempts).toBe(1.5); // 3 attempts / 2 sessions
    });

    it('returns empty when no tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      const result = await service.getTaskDifficultyStats('game-1');
      expect(result).toEqual([]);
    });
  });

  describe('getRunsBaseline', () => {
    it('averages players and completion rate across earlier ENDED runs only', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ runNumber: 3 });
      mockPrisma.gameRun.findMany.mockResolvedValue([
        {
          sessions: [
            { status: SessionStatus.COMPLETED },
            { status: SessionStatus.COMPLETED },
            { status: SessionStatus.ABANDONED },
            { status: SessionStatus.ABANDONED },
          ],
        }, // run #1: 4 players, 50% completion
        {
          sessions: [
            { status: SessionStatus.COMPLETED },
            { status: SessionStatus.COMPLETED },
            { status: SessionStatus.COMPLETED },
            { status: SessionStatus.COMPLETED },
            { status: SessionStatus.COMPLETED },
            { status: SessionStatus.TIMED_OUT },
          ],
        }, // run #2: 6 players, ~83.3% completion
      ]);

      const result = await service.getRunsBaseline('game-1', 'run-3');

      expect(result.runsCount).toBe(2);
      expect(result.avgTotalPlayers).toBe(5); // (4 + 6) / 2
      expect(result.avgCompletionRate).toBe(67); // round((0.5 + 5/6) / 2 * 100)
      expect(mockPrisma.gameRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gameId: 'game-1',
            status: RunStatus.ENDED,
            runNumber: { lt: 3 },
          }),
        }),
      );
    });

    it('returns zeros and runsCount=0 when no prior ended runs exist', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ runNumber: 1 });
      mockPrisma.gameRun.findMany.mockResolvedValue([]);

      const result = await service.getRunsBaseline('game-1', 'run-1');

      expect(result).toEqual({
        avgTotalPlayers: 0,
        avgCompletionRate: 0,
        runsCount: 0,
      });
    });

    it('throws NotFoundException when run does not belong to game', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue(null);

      await expect(service.getRunsBaseline('game-1', 'run-orphan'))
        .rejects.toThrow(NotFoundException);
    });

    it('handles prior runs with zero sessions without dividing by zero', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ runNumber: 2 });
      mockPrisma.gameRun.findMany.mockResolvedValue([
        { sessions: [] },
      ]);

      const result = await service.getRunsBaseline('game-1', 'run-2');

      expect(result.runsCount).toBe(1);
      expect(result.avgTotalPlayers).toBe(0);
      expect(result.avgCompletionRate).toBe(0);
    });
  });

  describe('getRunsComparison', () => {
    function makeRun(overrides: Record<string, unknown> = {}) {
      return {
        id: 'run-x',
        runNumber: 1,
        status: 'ENDED',
        startedAt: new Date('2026-05-01T00:00:00Z'),
        endedAt: new Date('2026-05-01T01:00:00Z'),
        sessions: [],
        ...overrides,
      };
    }

    it('returns timeline sorted by runNumber and excludes current run from priorTaskStats', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ id: 'run-curr' });
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't1', title: 'Task 1', orderIndex: 0 },
      ]);
      mockPrisma.gameRun.findMany.mockResolvedValue([
        makeRun({
          id: 'run-1',
          runNumber: 1,
          sessions: [
            { id: 's1', status: SessionStatus.COMPLETED, totalPoints: 100, startedAt: new Date('2026-05-01T00:00:00Z'), completedAt: new Date('2026-05-01T01:00:00Z') },
            { id: 's2', status: SessionStatus.ABANDONED, totalPoints: 50, startedAt: new Date('2026-05-01T00:00:00Z'), completedAt: null },
          ],
        }),
        makeRun({
          id: 'run-curr',
          runNumber: 2,
          sessions: [
            { id: 's3', status: SessionStatus.COMPLETED, totalPoints: 200, startedAt: new Date('2026-05-02T00:00:00Z'), completedAt: new Date('2026-05-02T00:30:00Z') },
          ],
        }),
      ]);
      // Prior session counts: 2 sessions in run-1
      mockPrisma.gameSession.groupBy.mockResolvedValue([{ gameRunId: 'run-1', _count: 2 }]);
      // Correct attempts grouped by task across priors
      mockPrisma.taskAttempt.groupBy.mockResolvedValue([{ taskId: 't1', _count: 1 }]);
      // All attempts across priors
      mockPrisma.taskAttempt.findMany.mockResolvedValue([
        { taskId: 't1', sessionId: 's1' },
        { taskId: 't1', sessionId: 's2' },
        { taskId: 't1', sessionId: 's2' },
      ]);

      const result = await service.getRunsComparison('game-1', 'run-curr');

      expect(result.runs).toHaveLength(2);
      expect(result.runs[0].runNumber).toBe(1);
      expect(result.runs[1].runNumber).toBe(2);
      expect(result.runs[0].totalPlayers).toBe(2);
      expect(result.runs[0].completionRate).toBe(50);
      // 150 total points (sum of all sessions) / 1 completed.
      // Quirky but matches the aggregate page convention.
      expect(result.runs[0].avgScore).toBe(150);
      // Only the session with completedAt counts: 60 min / 1 = 60.
      expect(result.runs[0].avgTimeMinutes).toBe(60);
      expect(result.priorRunsCount).toBe(1);
      // 1 correct / 2 prior sessions = 50%
      expect(result.priorTaskStats[0].priorCompletionRate).toBe(50);
      // 3 attempts / 2 distinct sessions = 1.5
      expect(result.priorTaskStats[0].priorAvgAttempts).toBe(1.5);
    });

    it('returns priorRunsCount=0 and zero stats when the current run is the only one', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ id: 'run-only' });
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't1', title: 'Task 1', orderIndex: 0 },
      ]);
      mockPrisma.gameRun.findMany.mockResolvedValue([
        makeRun({ id: 'run-only', runNumber: 1, sessions: [] }),
      ]);

      const result = await service.getRunsComparison('game-1', 'run-only');

      expect(result.runs).toHaveLength(1);
      expect(result.priorRunsCount).toBe(0);
      expect(result.priorTaskStats[0].priorCompletionRate).toBe(0);
      expect(result.priorTaskStats[0].priorAvgAttempts).toBe(0);
      expect(result.priorTaskStats[0].priorRunsCount).toBe(0);
      // Prior aggregation queries should NOT be issued when there are no priors.
      expect(mockPrisma.gameSession.groupBy).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when current run does not belong to game', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue(null);

      await expect(service.getRunsComparison('game-1', 'orphan'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getAiVerificationStats', () => {
    it('returns per-task AI evaluation stats', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't1', title: 'AI Task' },
      ]);
      mockPrisma.taskAttempt.findMany.mockResolvedValue([
        { taskId: 't1', status: AttemptStatus.CORRECT, aiResult: { score: 0.9 } },
        { taskId: 't1', status: AttemptStatus.ERROR, aiResult: { score: 0 } },
      ]);

      const result = await service.getAiVerificationStats('game-1');

      expect(result).toHaveLength(1);
      expect(result[0].evaluations).toBe(2);
      expect(result[0].errorRate).toBe(50);
    });
  });
});
