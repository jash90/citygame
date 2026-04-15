import { Test, TestingModule } from '@nestjs/testing';
import { TeamRankingService } from './team-ranking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

const mockRedis = {
  zadd: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  zrevrangebyscore: jest.fn().mockResolvedValue([]),
  on: jest.fn(),
  status: 'ready',
};

const mockPrisma = {
  gameSession: {
    groupBy: jest.fn().mockResolvedValue([]),
    findMany: jest.fn().mockResolvedValue([]),
  },
  team: { findMany: jest.fn().mockResolvedValue([]) },
};

describe('TeamRankingService', () => {
  let service: TeamRankingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamRankingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<TeamRankingService>(TeamRankingService);
    jest.clearAllMocks();
  });

  describe('updateTeamScore', () => {
    it('calls Redis ZADD with team ranking key', async () => {
      await service.updateTeamScore('run-1', 'team-1', 500);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'ranking:run:run-1:teams',
        500,
        'team-1',
      );
    });
  });

  describe('getTeamRanking', () => {
    it('returns team entries sorted by score', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValue([
        'team-a',
        '500',
        'team-b',
        '300',
      ]);

      const result = await service.getTeamRanking('run-1');

      expect(result).toEqual([
        { teamId: 'team-a', score: 500, rank: 1 },
        { teamId: 'team-b', score: 300, rank: 2 },
      ]);
    });
  });

  describe('getTeamRankingWithNames', () => {
    it('enriches entries with team name and member count', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValue([
        'team-1',
        '500',
      ]);
      mockPrisma.team.findMany.mockResolvedValue([
        { id: 'team-1', name: 'Alpha', _count: { members: 4 } },
      ]);

      const result = await service.getTeamRankingWithNames('run-1');

      expect(result).toEqual([
        {
          teamId: 'team-1',
          name: 'Alpha',
          memberCount: 4,
          totalPoints: 500,
          rank: 1,
        },
      ]);
    });
  });
});
