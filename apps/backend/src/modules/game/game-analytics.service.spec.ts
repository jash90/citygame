import { Test, TestingModule } from '@nestjs/testing';
import { AttemptStatus, SessionStatus } from '@prisma/client';
import { GameAnalyticsService } from './game-analytics.service';
import { GameService } from './game.service';
import { PrismaService } from '../../prisma/prisma.service';

const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: Record<string, any> = {
  gameSession: { groupBy: jest.fn() },
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
