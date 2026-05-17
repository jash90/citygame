import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AttemptStatus,
  Prisma,
  RunStatus,
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
   * Baseline for trend computation: averages from all earlier ENDED runs
   * of this game. Used to anchor "Δ vs prior runs" cards on the per-run page.
   * Returns zeros (and runsCount=0) when no prior ended runs exist — caller
   * should treat that as "no trend available" rather than a real zero.
   */
  async getRunsBaseline(gameId: string, runId: string) {
    await this.gameService.findOne(gameId);

    const currentRun = await this.prisma.gameRun.findFirst({
      where: { id: runId, gameId },
      select: { runNumber: true },
    });

    if (!currentRun) {
      throw new NotFoundException(`Run ${runId} not found for game ${gameId}`);
    }

    const priorRuns = await this.prisma.gameRun.findMany({
      where: {
        gameId,
        status: RunStatus.ENDED,
        runNumber: { lt: currentRun.runNumber },
      },
      include: {
        sessions: { select: { status: true } },
      },
    });

    if (priorRuns.length === 0) {
      return { avgTotalPlayers: 0, avgCompletionRate: 0, runsCount: 0 };
    }

    let totalPlayersSum = 0;
    let completionRateSum = 0;

    for (const run of priorRuns) {
      const total = run.sessions.length;
      const completed = run.sessions.filter(
        (s) => s.status === SessionStatus.COMPLETED,
      ).length;
      totalPlayersSum += total;
      completionRateSum += total > 0 ? completed / total : 0;
    }

    return {
      avgTotalPlayers: Math.round(totalPlayersSum / priorRuns.length),
      avgCompletionRate: Math.round(
        (completionRateSum / priorRuns.length) * 100,
      ),
      runsCount: priorRuns.length,
    };
  }

  /**
   * Side-by-side comparison data for the per-run page:
   * - `runs`: timeline of all runs belonging to the game (ordered by runNumber),
   *   with summary metrics per run for cross-run bar charts.
   * - `priorTaskStats`: per-task completion rates and avg attempts averaged
   *   across runs *other than* `currentRunId`. Used to overlay a reference
   *   series on funnel/difficulty charts.
   */
  async getRunsComparison(gameId: string, currentRunId: string) {
    await this.gameService.findOne(gameId);

    const currentRun = await this.prisma.gameRun.findFirst({
      where: { id: currentRunId, gameId },
      select: { id: true },
    });
    if (!currentRun) {
      throw new NotFoundException(
        `Run ${currentRunId} not found for game ${gameId}`,
      );
    }

    const [tasks, runs] = await Promise.all([
      this.prisma.task.findMany({
        where: { gameId },
        select: { id: true, title: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.gameRun.findMany({
        where: { gameId },
        orderBy: { runNumber: 'asc' },
        include: {
          sessions: {
            select: {
              id: true,
              status: true,
              totalPoints: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      }),
    ]);

    // Per-run summary metrics (timeline)
    const timeline = runs.map((run) => {
      const sessions = run.sessions;
      const total = sessions.length;
      const completed = sessions.filter(
        (s) => s.status === SessionStatus.COMPLETED,
      );
      const completionRate =
        total > 0 ? Math.round((completed.length / total) * 100) : 0;
      const totalPoints = sessions.reduce(
        (sum, s) => sum + (s.totalPoints ?? 0),
        0,
      );
      const avgScore =
        completed.length > 0 ? Math.round(totalPoints / completed.length) : 0;
      // Match the per-run metric card: any session with completedAt counts,
      // not only COMPLETED — TIMED_OUT/ABANDONED also have completedAt and
      // represent real player time spent.
      const finishedSessions = sessions.filter(
        (s) => s.completedAt != null,
      );
      const totalMs = finishedSessions.reduce(
        (sum, s) =>
          sum +
          Math.max(
            0,
            new Date(s.completedAt as Date).getTime() -
              new Date(s.startedAt).getTime(),
          ),
        0,
      );
      const avgTimeMinutes =
        finishedSessions.length > 0
          ? Math.round(totalMs / finishedSessions.length / 60_000)
          : 0;

      return {
        runId: run.id,
        runNumber: run.runNumber,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        totalPlayers: total,
        completionRate,
        avgScore,
        avgTimeMinutes,
      };
    });

    // Per-task prior stats — exclude the current run
    const priorRunIds = runs
      .filter((r) => r.id !== currentRunId)
      .map((r) => r.id);

    let priorTaskStats: {
      taskId: string;
      taskTitle: string;
      priorCompletionRate: number;
      priorAvgAttempts: number;
      priorRunsCount: number;
    }[] = tasks.map((t) => ({
      taskId: t.id,
      taskTitle: t.title,
      priorCompletionRate: 0,
      priorAvgAttempts: 0,
      priorRunsCount: 0,
    }));

    if (priorRunIds.length > 0) {
      const [priorSessionsCount, priorCorrectByTask, priorAttemptsByTask] =
        await Promise.all([
          // Total sessions count per prior run — used as denominator
          this.prisma.gameSession.groupBy({
            by: ['gameRunId'],
            where: { gameId, gameRunId: { in: priorRunIds } },
            _count: true,
          }),
          // Correct attempts per (run, task)
          this.prisma.taskAttempt.groupBy({
            by: ['taskId'],
            where: {
              task: { gameId },
              status: AttemptStatus.CORRECT,
              session: { gameRunId: { in: priorRunIds } },
            },
            _count: true,
          }),
          // All attempts per task (across prior runs) + distinct sessions
          this.prisma.taskAttempt.findMany({
            where: {
              task: { gameId },
              session: { gameRunId: { in: priorRunIds } },
            },
            select: { taskId: true, sessionId: true },
          }),
        ]);

      const totalPriorSessions = priorSessionsCount.reduce(
        (sum, r) => sum + r._count,
        0,
      );
      const correctMap = new Map(
        priorCorrectByTask.map((c) => [c.taskId, c._count]),
      );
      const attemptsByTaskMap = new Map<string, Set<string>>();
      const attemptsTotalByTask = new Map<string, number>();
      for (const a of priorAttemptsByTask) {
        let bucket = attemptsByTaskMap.get(a.taskId);
        if (!bucket) {
          bucket = new Set();
          attemptsByTaskMap.set(a.taskId, bucket);
        }
        bucket.add(a.sessionId);
        attemptsTotalByTask.set(
          a.taskId,
          (attemptsTotalByTask.get(a.taskId) ?? 0) + 1,
        );
      }

      priorTaskStats = tasks.map((t) => {
        const correct = correctMap.get(t.id) ?? 0;
        const totalAttempts = attemptsTotalByTask.get(t.id) ?? 0;
        const distinctSessions = attemptsByTaskMap.get(t.id)?.size ?? 0;
        const priorCompletionRate =
          totalPriorSessions > 0
            ? Math.round((correct / totalPriorSessions) * 100)
            : 0;
        const priorAvgAttempts =
          distinctSessions > 0
            ? parseFloat((totalAttempts / distinctSessions).toFixed(1))
            : 0;
        return {
          taskId: t.id,
          taskTitle: t.title,
          priorCompletionRate,
          priorAvgAttempts,
          priorRunsCount: priorRunIds.length,
        };
      });
    }

    return {
      runs: timeline,
      priorTaskStats,
      priorRunsCount: priorRunIds.length,
    };
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
