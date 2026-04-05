import { Injectable } from '@nestjs/common';
import {
  AttemptStatus,
  Prisma,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GameService } from './game.service';

@Injectable()
export class GameAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameService: GameService,
  ) {}

  /**
   * Aggregate game statistics for the admin dashboard.
   */
  async getGameStats(gameId: string, runId?: string) {
    await this.gameService.findOne(gameId);

    const sessionWhere: Prisma.GameSessionWhereInput = { gameId };
    if (runId) sessionWhere.gameRunId = runId;

    const attemptWhere: Prisma.TaskAttemptWhereInput = { task: { gameId } };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const [sessionStats, totalAttempts, tasks, correctByTask] = await Promise.all([
      this.prisma.gameSession.groupBy({
        by: ['status'],
        where: sessionWhere,
        _count: true,
      }),
      this.prisma.taskAttempt.count({
        where: attemptWhere,
      }),
      this.prisma.task.findMany({
        where: { gameId },
        select: {
          id: true,
          title: true,
        },
      }),
      this.prisma.taskAttempt.groupBy({
        by: ['taskId'],
        where: { ...attemptWhere, status: AttemptStatus.CORRECT },
        _count: true,
      }),
    ]);

    // Count per-task attempts within scope (run-filtered)
    const attemptsByTask = await this.prisma.taskAttempt.groupBy({
      by: ['taskId'],
      where: attemptWhere,
      _count: true,
    });
    const attemptsByTaskMap = new Map(attemptsByTask.map((a) => [a.taskId, a._count]));

    const totalSessions = sessionStats.reduce((sum, s) => sum + s._count, 0);
    const activeSessions =
      sessionStats.find((s) => s.status === SessionStatus.ACTIVE)?._count ?? 0;
    const completedSessions =
      sessionStats.find((s) => s.status === SessionStatus.COMPLETED)?._count ?? 0;

    const correctMap = new Map(correctByTask.map((c) => [c.taskId, c._count]));

    const taskCompletionRates = tasks.map((t) => ({
      taskId: t.id,
      title: t.title,
      completedCount: correctMap.get(t.id) ?? 0,
      totalAttempts: attemptsByTaskMap.get(t.id) ?? 0,
    }));

    const avgCompletionRate =
      taskCompletionRates.length > 0
        ? taskCompletionRates.reduce(
            (sum, r) =>
              sum + (r.totalAttempts > 0 ? r.completedCount / r.totalAttempts : 0),
            0,
          ) / taskCompletionRates.length
        : 0;

    return {
      totalSessions,
      activeSessions,
      completedSessions,
      totalAttempts,
      avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
      taskCompletionRates,
    };
  }

  /**
   * Player activity time-series: unique players and task completions per day.
   */
  async getPlayerActivityTimeSeries(gameId: string, days: number, runId?: string) {
    await this.gameService.findOne(gameId);

    const cappedDays = Math.min(Math.max(1, days), 365);

    const since = new Date();
    since.setDate(since.getDate() - cappedDays);
    since.setHours(0, 0, 0, 0);

    const sessionWhere: Prisma.GameSessionWhereInput = { gameId, startedAt: { gte: since } };
    if (runId) sessionWhere.gameRunId = runId;

    const attemptWhere: Prisma.TaskAttemptWhereInput = {
      task: { gameId },
      status: AttemptStatus.CORRECT,
      createdAt: { gte: since },
    };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const [sessions, attempts] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: sessionWhere,
        select: { userId: true, startedAt: true },
      }),
      this.prisma.taskAttempt.findMany({
        where: attemptWhere,
        select: { createdAt: true },
      }),
    ]);

    const dateMap = new Map<string, { players: Set<string>; completions: number }>();

    for (let i = 0; i < cappedDays; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { players: new Set(), completions: 0 });
    }

    for (const s of sessions) {
      const key = new Date(s.startedAt).toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry) entry.players.add(s.userId);
    }

    for (const a of attempts) {
      const key = new Date(a.createdAt).toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry) entry.completions++;
    }

    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { players, completions }]) => ({
        date,
        players: players.size,
        completions,
      }));
  }

  /**
   * Task difficulty: average attempts per task (total attempts / unique sessions).
   */
  async getTaskDifficultyStats(gameId: string, runId?: string) {
    await this.gameService.findOne(gameId);

    const tasks = await this.prisma.task.findMany({
      where: { gameId },
      select: { id: true, title: true },
      orderBy: { orderIndex: 'asc' },
    });

    if (tasks.length === 0) return [];

    const attemptWhere: Prisma.TaskAttemptWhereInput = { task: { gameId } };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const attempts = await this.prisma.taskAttempt.findMany({
      where: attemptWhere,
      select: { taskId: true, sessionId: true },
    });

    const taskMap = new Map<string, { total: number; sessions: Set<string> }>();
    for (const a of attempts) {
      let entry = taskMap.get(a.taskId);
      if (!entry) {
        entry = { total: 0, sessions: new Set() };
        taskMap.set(a.taskId, entry);
      }
      entry.total++;
      entry.sessions.add(a.sessionId);
    }

    return tasks.map((t) => {
      const entry = taskMap.get(t.id);
      const avgAttempts =
        entry && entry.sessions.size > 0
          ? parseFloat((entry.total / entry.sessions.size).toFixed(1))
          : 0;
      return {
        taskId: t.id,
        taskTitle: t.title,
        avgAttempts,
        avgTimeSec: 0,
      };
    });
  }

  /**
   * AI verification stats: per-task evaluation count, avg score, error rate.
   */
  async getAiVerificationStats(gameId: string, runId?: string) {
    await this.gameService.findOne(gameId);

    const tasks = await this.prisma.task.findMany({
      where: { gameId },
      select: { id: true, title: true },
      orderBy: { orderIndex: 'asc' },
    });

    if (tasks.length === 0) return [];

    const attemptWhere: Prisma.TaskAttemptWhereInput = {
      task: { gameId },
      aiResult: { not: Prisma.JsonNull },
    };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const attempts = await this.prisma.taskAttempt.findMany({
      where: attemptWhere,
      select: { taskId: true, aiResult: true, status: true },
    });

    const taskMap = new Map<
      string,
      { scores: number[]; errorCount: number; total: number }
    >();

    for (const a of attempts) {
      let entry = taskMap.get(a.taskId);
      if (!entry) {
        entry = { scores: [], errorCount: 0, total: 0 };
        taskMap.set(a.taskId, entry);
      }
      entry.total++;
      if (a.status === AttemptStatus.ERROR) entry.errorCount++;

      const result = a.aiResult as Record<string, unknown> | null;
      if (result && typeof result.score === 'number') {
        entry.scores.push(result.score);
      }
    }

    return tasks.map((t) => {
      const entry = taskMap.get(t.id);
      if (!entry || entry.total === 0) {
        return {
          taskName: t.title,
          evaluations: 0,
          avgScore: 0,
          errorRate: 0,
        };
      }

      const avgScore =
        entry.scores.length > 0
          ? parseFloat(
              (
                (entry.scores.reduce((sum, s) => sum + s, 0) /
                  entry.scores.length) *
                100
              ).toFixed(1),
            )
          : 0;

      return {
        taskName: t.title,
        evaluations: entry.total,
        avgScore,
        errorRate: parseFloat(
          ((entry.errorCount / entry.total) * 100).toFixed(1),
        ),
      };
    });
  }
}
