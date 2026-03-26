import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttemptStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

export interface RankEntry {
  userId: string;
  score: number;
  rank: number;
}

export interface TeamRankEntry {
  teamId: string;
  score: number;
  rank: number;
}

export interface EnrichedTeamRankEntry {
  teamId: string;
  name: string;
  memberCount: number;
  totalPoints: number;
  rank: number;
}

export interface UserRankResult {
  userId: string;
  score: number;
  rank: number | null;
}

export interface EnrichedRankEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  completedTasks: number;
  rank: number;
}

@Injectable()
export class RankingService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(RankingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.redis = new Redis(
      this.configService.getOrThrow<string>('REDIS_URL'),
      { lazyConnect: true },
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      this.logger.warn('Redis connection failed — ranking will be unavailable', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Redis key for the sorted set of a game's player leaderboard.
   */
  private rankingKey(gameId: string): string {
    return `ranking:game:${gameId}`;
  }

  /**
   * Redis key for the sorted set of a game's team leaderboard.
   */
  private teamRankingKey(gameId: string): string {
    return `ranking:game:${gameId}:teams`;
  }

  /**
   * Update (or add) a player's score in the game leaderboard sorted set.
   * Uses ZADD with the absolute score (not an increment).
   */
  async updateScore(gameId: string, userId: string, points: number): Promise<void> {
    await this.redis.zadd(this.rankingKey(gameId), points, userId);
  }

  /**
   * Get the top-N entries in a game leaderboard, highest score first.
   */
  async getRanking(gameId: string, limit = 50): Promise<RankEntry[]> {
    const results = await this.redis.zrevrangebyscore(
      this.rankingKey(gameId),
      '+inf',
      '-inf',
      'WITHSCORES',
      'LIMIT',
      0,
      limit,
    );

    const entries: RankEntry[] = [];
    for (let i = 0; i < results.length; i += 2) {
      const userId = results[i] as string;
      const score = parseFloat(results[i + 1] as string);
      entries.push({ userId, score, rank: entries.length + 1 });
    }

    return entries;
  }

  /**
   * Get the top-N leaderboard entries enriched with Prisma user profile data.
   * Falls back to userId as display name if the user record is missing.
   */
  async getRankingWithNames(gameId: string, limit = 50): Promise<EnrichedRankEntry[]> {
    const rawEntries = await this.getRanking(gameId, limit);

    if (rawEntries.length === 0) {
      return [];
    }

    const userIds = rawEntries.map((e) => e.userId);

    // Fetch user profiles and per-user correct-attempt counts for this game in parallel.
    // groupBy does not support relation filters, so we query sessions first to get session ids.
    const [users, sessions] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, avatarUrl: true },
      }),
      this.prisma.gameSession.findMany({
        where: { gameId, userId: { in: userIds } },
        select: { id: true, userId: true },
      }),
    ]);

    const sessionIds = sessions.map((s) => s.id);
    const sessionUserMap = new Map(sessions.map((s) => [s.id, s.userId]));

    const completedCounts = await this.prisma.taskAttempt.groupBy({
      by: ['sessionId'],
      where: {
        sessionId: { in: sessionIds },
        status: AttemptStatus.CORRECT,
      },
      _count: { id: true },
    });

    // Map userId -> total correct attempts count
    const countMap = new Map<string, number>();
    for (const row of completedCounts) {
      const userId = sessionUserMap.get(row.sessionId);
      if (userId !== undefined) {
        countMap.set(userId, (countMap.get(userId) ?? 0) + row._count.id);
      }
    }

    const userMap = new Map(users.map((u) => [u.id, u]));

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

  /**
   * Update (or add) a team's score in the game team leaderboard sorted set.
   * Uses ZADD with the absolute score (not an increment).
   */
  async updateTeamScore(gameId: string, teamId: string, points: number): Promise<void> {
    await this.redis.zadd(this.teamRankingKey(gameId), points, teamId);
  }

  /**
   * Get the top-N team entries in a game leaderboard, highest score first.
   */
  async getTeamRanking(gameId: string, limit = 50): Promise<TeamRankEntry[]> {
    const results = await this.redis.zrevrangebyscore(
      this.teamRankingKey(gameId),
      '+inf',
      '-inf',
      'WITHSCORES',
      'LIMIT',
      0,
      limit,
    );

    const entries: TeamRankEntry[] = [];
    for (let i = 0; i < results.length; i += 2) {
      const teamId = results[i] as string;
      const score = parseFloat(results[i + 1] as string);
      entries.push({ teamId, score, rank: entries.length + 1 });
    }

    return entries;
  }

  /**
   * Get the top-N team leaderboard entries enriched with team name and member count.
   */
  async getTeamRankingWithNames(gameId: string, limit = 50): Promise<EnrichedTeamRankEntry[]> {
    const rawEntries = await this.getTeamRanking(gameId, limit);

    if (rawEntries.length === 0) {
      return [];
    }

    const teamIds = rawEntries.map((e) => e.teamId);
    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
    });

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return rawEntries.map((entry) => {
      const team = teamMap.get(entry.teamId);
      return {
        teamId: entry.teamId,
        name: team?.name ?? entry.teamId,
        memberCount: team?._count.members ?? 0,
        totalPoints: entry.score,
        rank: entry.rank,
      };
    });
  }

  /**
   * Get a single user's rank and score in a game (1-based, highest score = rank 1).
   */
  async getUserRank(gameId: string, userId: string): Promise<UserRankResult> {
    const [scoreStr, rank] = await Promise.all([
      this.redis.zscore(this.rankingKey(gameId), userId),
      this.redis.zrevrank(this.rankingKey(gameId), userId),
    ]);

    return {
      userId,
      score: scoreStr !== null ? parseFloat(scoreStr) : 0,
      rank: rank !== null ? rank + 1 : null,
    };
  }
}
