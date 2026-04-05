import { Test, TestingModule } from '@nestjs/testing';
import { RankingService } from './ranking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockRedis = {
  zadd: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  zrevrangebyscore: jest.fn().mockResolvedValue([]),
  zscore: jest.fn().mockResolvedValue(null),
  zrevrank: jest.fn().mockResolvedValue(null),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
  status: 'ready',
};

const mockPrisma = {
  gameRun: { findFirst: jest.fn() },
  user: { findMany: jest.fn() },
  gameSession: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  taskAttempt: { groupBy: jest.fn() },
  team: { findMany: jest.fn() },
};

describe('RankingService', () => {
  let service: RankingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(RankingService);
  });

  describe('updateScore', () => {
    it('calls Redis ZADD with correct key and score', async () => {
      await service.updateScore('run-1', 'user-1', 150);

      expect(mockRedis.zadd).toHaveBeenCalledWith('ranking:run:run-1', 150, 'user-1');
    });
  });

  describe('getRanking', () => {
    it('returns entries sorted by score desc', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValue([
        'user-a', '300',
        'user-b', '200',
        'user-c', '100',
      ]);

      const result = await service.getRanking('run-1', 50);

      expect(result).toEqual([
        { userId: 'user-a', score: 300, rank: 1 },
        { userId: 'user-b', score: 200, rank: 2 },
        { userId: 'user-c', score: 100, rank: 3 },
      ]);
    });

    it('returns empty array when no entries', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValue([]);

      const result = await service.getRanking('run-1');
      expect(result).toEqual([]);
    });
  });

  describe('getRankingWithNames', () => {
    it('enriches entries with user data and completed tasks', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValue([
        'user-a', '200',
        'user-b', '100',
      ]);

      // Single query: sessions with nested user + _count
      mockPrisma.gameSession.findMany.mockResolvedValue([
        {
          userId: 'user-a',
          user: { id: 'user-a', displayName: 'Alice', avatarUrl: null },
          _count: { attempts: 3 },
        },
        {
          userId: 'user-b',
          user: { id: 'user-b', displayName: 'Bob', avatarUrl: 'http://avatar.jpg' },
          _count: { attempts: 1 },
        },
      ]);

      const result = await service.getRankingWithNames('run-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        userId: 'user-a',
        displayName: 'Alice',
        avatarUrl: null,
        totalPoints: 200,
        completedTasks: 3,
        rank: 1,
      });
      expect(result[1].displayName).toBe('Bob');
      expect(result[1].completedTasks).toBe(1);
    });

    it('returns empty array when no ranking entries', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValue([]);
      mockPrisma.gameSession.findMany.mockResolvedValue([]);

      const result = await service.getRankingWithNames('run-1');
      expect(result).toEqual([]);
    });
  });

  describe('getUserRank', () => {
    it('returns correct 1-based rank', async () => {
      mockRedis.zscore.mockResolvedValue('250');
      mockRedis.zrevrank.mockResolvedValue(2); // 0-based

      const result = await service.getUserRank('run-1', 'user-1');

      expect(result).toEqual({
        userId: 'user-1',
        score: 250,
        rank: 3, // 1-based
      });
    });

    it('returns null rank and 0 score for unranked user', async () => {
      mockRedis.zscore.mockResolvedValue(null);
      mockRedis.zrevrank.mockResolvedValue(null);

      const result = await service.getUserRank('run-1', 'no-user');

      expect(result).toEqual({
        userId: 'no-user',
        score: 0,
        rank: null,
      });
    });
  });

  describe('updateTeamScore', () => {
    it('calls Redis ZADD with team ranking key', async () => {
      await service.updateTeamScore('run-1', 'team-1', 500);

      expect(mockRedis.zadd).toHaveBeenCalledWith('ranking:run:run-1:teams', 500, 'team-1');
    });
  });

  describe('getTeamRanking', () => {
    it('returns team entries sorted by score', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValue([
        'team-a', '500',
        'team-b', '300',
      ]);

      const result = await service.getTeamRanking('run-1');

      expect(result).toEqual([
        { teamId: 'team-a', score: 500, rank: 1 },
        { teamId: 'team-b', score: 300, rank: 2 },
      ]);
    });
  });

  describe('getActiveRunId', () => {
    it('returns run id when active run exists', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue({ id: 'run-123' });

      const result = await service.getActiveRunId('game-1');
      expect(result).toBe('run-123');
    });

    it('returns null when no active run', async () => {
      mockPrisma.gameRun.findFirst.mockResolvedValue(null);

      const result = await service.getActiveRunId('game-1');
      expect(result).toBeNull();
    });
  });
});
