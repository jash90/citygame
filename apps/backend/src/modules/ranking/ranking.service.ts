import { Inject, Injectable, Logger } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { PrismaService } from '../../prisma/prisma.service';

export interface RankEntry {
  userId: string;
  score: number;
  rank: number;
}

export interface EnrichedRankEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  completedTasks: number;
  rank: number;
}

export interface UserRankResult {
  userId: string;
  score: number;
  rank: number | null;
}

/** TTL for ranking sorted sets — 7 days after last update. */
const RANKING_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);
  private redisAvailable = true;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {
    this.redis.on('error', () => {
      if (this.redisAvailable) {
        this.logger.warn('Redis connection lost — ranking will use DB fallback');
      }
      this.redisAvailable = false;
    });
    this.redis.on('connect', () => {
      if (!this.redisAvailable) {
        this.logger.log('Redis connection restored');
      }
      this.redisAvailable = true;
    });
    this.redisAvailable = this.redis.status === 'ready';
  }

  private rankingKey(runId: string): string {
    return `ranking:run:${runId}`;
  }

  async getActiveRunId(gameId: string): Promise<string | null> {
    const run = await this.prisma.gameRun.findFirst({
      where: { gameId, status: 'ACTIVE' },
      select: { id: true },
    });
    return run?.id ?? null;
  }

  async updateScore(runId: string, userId: string, points: number): Promise<void> {
    try {
      const key = this.rankingKey(runId);
      await this.redis.zadd(key, points, userId);
      await this.redis.expire(key, RANKING_TTL_SECONDS);
    } catch (error) {
      this.logger.error(`Redis updateScore failed for run ${runId}`, error);
    }
  }

  async getRanking(runId: string, limit = 50): Promise<RankEntry[]> {
    try {
      const results = await this.redis.zrevrangebyscore(
        this.rankingKey(runId),
        '+inf',
        '-inf',
        'WITHSCORES',
        'LIMIT',
        0,
        limit,
      );

      if (this.redisAvailable && results.length > 0) {
        const entries: RankEntry[] = [];
        for (let i = 0; i < results.length; i += 2) {
          const userId = results[i] as string;
          const score = parseFloat(results[i + 1] as string);
          entries.push({ userId, score, rank: entries.length + 1 });
        }
        return entries;
      }
    } catch (error) {
      this.logger.warn(`Redis getRanking failed for run ${runId}, using DB fallback`, error);
    }

    return this.getRankingFromDb(runId, limit);
  }

  private async getRankingFromDb(runId: string, limit: number): Promise<RankEntry[]> {
    const sessions = await this.prisma.gameSession.findMany({
      where: { gameRunId: runId },
      orderBy: { totalPoints: 'desc' },
      take: limit,
      select: { userId: true, totalPoints: true },
    });

    return sessions.map((s, i) => ({
      userId: s.userId,
      score: s.totalPoints,
      rank: i + 1,
    }));
  }

  async getRankingWithNames(runId: string, limit = 50): Promise<EnrichedRankEntry[]> {
    const rawEntries = await this.getRanking(runId, limit);

    if (rawEntries.length === 0) {
      return [];
    }

    const userIds = rawEntries.map((e) => e.userId);

    const sessions = await this.prisma.gameSession.findMany({
      where: { gameRunId: runId, userId: { in: userIds } },
      select: {
        userId: true,
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: {
          select: {
            attempts: { where: { status: AttemptStatus.CORRECT } },
          },
        },
      },
    });

    const userMap = new Map<string, { displayName: string; avatarUrl: string | null }>();
    const countMap = new Map<string, number>();

    for (const s of sessions) {
      userMap.set(s.userId, {
        displayName: s.user.displayName,
        avatarUrl: s.user.avatarUrl,
      });
      countMap.set(
        s.userId,
        (countMap.get(s.userId) ?? 0) + s._count.attempts,
      );
    }

    return rawEntries.map((entry) => {
      const user = userMap.get(entry.userId);
      return {
        userId: entry.userId,
        displayName: user?.displayName ?? entry.userId,
        avatarUrl: user?.avatarUrl ?? null,
        totalPoints: entry.score,
        completedTasks: countMap.get(entry.userId) ?? 0,
        rank: entry.rank,
      };
    });
  }

  async getUserRank(runId: string, userId: string): Promise<UserRankResult> {
    try {
      const [scoreStr, rank] = await Promise.all([
        this.redis.zscore(this.rankingKey(runId), userId),
        this.redis.zrevrank(this.rankingKey(runId), userId),
      ]);

      return {
        userId,
        score: scoreStr !== null ? parseFloat(scoreStr) : 0,
        rank: rank !== null ? rank + 1 : null,
      };
    } catch (error) {
      this.logger.warn(`Redis getUserRank failed for run ${runId}`, error);

      const session = await this.prisma.gameSession.findUnique({
        where: { gameRunId_userId: { gameRunId: runId, userId } },
        select: { totalPoints: true },
      });

      if (!session) {
        return { userId, score: 0, rank: null };
      }

      const higherCount = await this.prisma.gameSession.count({
        where: { gameRunId: runId, totalPoints: { gt: session.totalPoints } },
      });

      return {
        userId,
        score: session.totalPoints,
        rank: higherCount + 1,
      };
    }
  }
}
