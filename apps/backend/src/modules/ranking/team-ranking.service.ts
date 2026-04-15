import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { PrismaService } from '../../prisma/prisma.service';

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

/** TTL for ranking sorted sets — 7 days after last update. */
const RANKING_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class TeamRankingService {
  private readonly logger = new Logger(TeamRankingService.name);
  private redisAvailable = true;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {
    this.redis.on('error', () => {
      this.redisAvailable = false;
    });
    this.redis.on('connect', () => {
      this.redisAvailable = true;
    });
    this.redisAvailable = this.redis.status === 'ready';
  }

  private teamRankingKey(runId: string): string {
    return `ranking:run:${runId}:teams`;
  }

  async updateTeamScore(runId: string, teamId: string, points: number): Promise<void> {
    try {
      const key = this.teamRankingKey(runId);
      await this.redis.zadd(key, points, teamId);
      await this.redis.expire(key, RANKING_TTL_SECONDS);
    } catch (error) {
      this.logger.error(`Redis updateTeamScore failed for run ${runId}`, error);
    }
  }

  async getTeamRanking(runId: string, limit = 50): Promise<TeamRankEntry[]> {
    try {
      const results = await this.redis.zrevrangebyscore(
        this.teamRankingKey(runId),
        '+inf',
        '-inf',
        'WITHSCORES',
        'LIMIT',
        0,
        limit,
      );

      if (this.redisAvailable && results.length > 0) {
        const entries: TeamRankEntry[] = [];
        for (let i = 0; i < results.length; i += 2) {
          const teamId = results[i] as string;
          const score = parseFloat(results[i + 1] as string);
          entries.push({ teamId, score, rank: entries.length + 1 });
        }
        return entries;
      }
    } catch (error) {
      this.logger.warn(`Redis getTeamRanking failed for run ${runId}, using DB fallback`, error);
    }

    const teamSessions = await this.prisma.gameSession.groupBy({
      by: ['teamId'],
      where: { gameRunId: runId, teamId: { not: null } },
      _max: { totalPoints: true },
      orderBy: { _max: { totalPoints: 'desc' } },
      take: limit,
    });

    return teamSessions
      .filter((s) => s.teamId !== null)
      .map((s, i) => ({
        teamId: s.teamId!,
        score: s._max.totalPoints ?? 0,
        rank: i + 1,
      }));
  }

  async getTeamRankingWithNames(runId: string, limit = 50): Promise<EnrichedTeamRankEntry[]> {
    const rawEntries = await this.getTeamRanking(runId, limit);

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
}
