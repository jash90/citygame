'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/shared/lib/admin-api';
import {
  buildScoreDistribution,
  buildTaskFunnel,
  buildTopPlayers,
  truncate,
  type AdminGameSession,
} from '../lib/transforms';
import type { AnalyticsData, RunTimelinePoint } from './useAnalytics.types';

const MS_PER_DAY = 86_400_000;

function computeDays(startedAt: Date, endedAt: Date | null): number {
  const end = endedAt ?? new Date();
  const span = end.getTime() - startedAt.getTime();
  return Math.max(1, Math.ceil(span / MS_PER_DAY));
}

function trend(current: number, baseline: number, baselineRuns: number): number | null {
  if (baselineRuns === 0) return null;
  if (baseline === 0) return current === 0 ? 0 : null;
  return Math.round(((current - baseline) / baseline) * 100);
}

/**
 * Per-run analytics scoped to a single GameRun. Time-series window is derived
 * from the run's startedAt → endedAt (or now() if still active). Trends are
 * computed against the average of all earlier ENDED runs of the same game.
 */
export function useRunAnalytics(gameId: string, runId: string) {
  const gameQuery = useQuery({
    queryKey: ['admin-game', gameId],
    queryFn: () => adminApi.getGame(gameId),
    staleTime: 60_000,
  });

  const runDetailQuery = useQuery({
    queryKey: ['admin-run', gameId, runId],
    queryFn: () => adminApi.getRunDetail(gameId, runId),
    staleTime: 30_000,
  });

  const baselineQuery = useQuery({
    queryKey: ['admin-run-baseline', gameId, runId],
    queryFn: () => adminApi.getRunBaseline(gameId, runId),
    staleTime: 60_000,
  });

  const comparisonQuery = useQuery({
    queryKey: ['admin-run-comparison', gameId, runId],
    queryFn: () => adminApi.getRunComparison(gameId, runId),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ['analytics', gameId, 'stats', runId],
    queryFn: () => adminApi.getGameStats(gameId, runId),
    staleTime: 30_000,
  });

  const sessionsQuery = useQuery({
    queryKey: ['analytics', gameId, 'sessions', runId],
    queryFn: async () => {
      const page = await adminApi.getGameSessions(gameId, runId);
      return (page.items ?? []) as AdminGameSession[];
    },
    staleTime: 30_000,
  });

  const runDetail = runDetailQuery.data;
  const startedAt = runDetail ? new Date(runDetail.startedAt) : null;
  const endedAt = runDetail?.endedAt ? new Date(runDetail.endedAt) : null;
  const days = startedAt ? computeDays(startedAt, endedAt) : 30;

  const activityQuery = useQuery({
    queryKey: ['analytics', gameId, 'activity', 'run', runId, days],
    queryFn: () => adminApi.getPlayerActivity(gameId, days, runId),
    staleTime: 30_000,
    enabled: !!runDetail,
  });

  const difficultyQuery = useQuery({
    queryKey: ['analytics', gameId, 'task-difficulty', runId],
    queryFn: () => adminApi.getTaskDifficulty(gameId, runId),
    staleTime: 60_000,
  });

  const aiStatsQuery = useQuery({
    queryKey: ['analytics', gameId, 'ai-verification', runId],
    queryFn: () => adminApi.getAiVerificationStats(gameId, runId),
    staleTime: 60_000,
  });

  const isLoading =
    gameQuery.isLoading ||
    runDetailQuery.isLoading ||
    baselineQuery.isLoading ||
    comparisonQuery.isLoading ||
    statsQuery.isLoading ||
    sessionsQuery.isLoading ||
    activityQuery.isLoading ||
    difficultyQuery.isLoading ||
    aiStatsQuery.isLoading;

  const error =
    gameQuery.error ??
    runDetailQuery.error ??
    baselineQuery.error ??
    comparisonQuery.error ??
    statsQuery.error ??
    sessionsQuery.error ??
    activityQuery.error ??
    difficultyQuery.error ??
    aiStatsQuery.error;

  let data: AnalyticsData | null = null;

  let timeline: RunTimelinePoint[] = [];

  if (gameQuery.data && statsQuery.data && runDetail) {
    const stats = statsQuery.data;
    const sessions = (sessionsQuery.data ?? []) as AdminGameSession[];
    const tasks = gameQuery.data.tasks ?? [];
    const baseline = baselineQuery.data;
    const comparison = comparisonQuery.data;

    const totalPlayers = stats.totalSessions;
    const completedSessions = stats.completedSessions;
    const completionRate =
      totalPlayers > 0 ? Math.round((completedSessions / totalPlayers) * 100) : 0;

    const completedSessionsList = sessions.filter((s) => s.completedAt && s.startedAt);
    const totalScore = sessions.reduce((sum, s) => sum + (s.totalPoints ?? 0), 0);
    const averageScore =
      completedSessions > 0 ? Math.round(totalScore / completedSessions) : 0;

    let averageTimeMinutes = 0;
    if (completedSessionsList.length > 0) {
      const totalMs = completedSessionsList.reduce((sum, s) => {
        const ms = new Date(s.completedAt!).getTime() - new Date(s.startedAt).getTime();
        return sum + Math.max(0, ms);
      }, 0);
      averageTimeMinutes = Math.round(totalMs / completedSessionsList.length / 60_000);
    }

    const playerActivity = (activityQuery.data ?? []).map((d) => ({
      date: new Date(d.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
      players: d.players,
      completions: d.completions,
    }));

    // Index prior stats by taskId (funnel) and by full title (difficulty,
    // since difficulty endpoint doesn't expose taskId in its response shape).
    const hasPriors = (comparison?.priorRunsCount ?? 0) > 0;
    const priorRateByTaskId = new Map(
      (comparison?.priorTaskStats ?? []).map((p) => [
        p.taskId,
        p.priorCompletionRate,
      ]),
    );
    const priorByTaskTitle = new Map(
      (comparison?.priorTaskStats ?? []).map((p) => [
        p.taskTitle,
        { rate: p.priorCompletionRate, attempts: p.priorAvgAttempts },
      ]),
    );

    const taskDifficulty = (difficultyQuery.data ?? []).map((d) => ({
      taskTitle: truncate(d.taskTitle, 22),
      avgAttempts: d.avgAttempts,
      avgTimeSec: d.avgTimeSec,
      priorAvgAttempts: hasPriors
        ? priorByTaskTitle.get(d.taskTitle)?.attempts
        : undefined,
    }));

    if (comparison) {
      timeline = comparison.runs.map((r) => ({
        runId: r.runId,
        runNumber: r.runNumber,
        isCurrent: r.runId === runId,
        totalPlayers: r.totalPlayers,
        completionRate: r.completionRate,
        avgScore: r.avgScore,
        avgTimeMinutes: r.avgTimeMinutes,
      }));
    }

    data = {
      totalPlayers,
      completionRate,
      averageScore,
      averageTimeMinutes,
      playersTrend: baseline
        ? trend(totalPlayers, baseline.avgTotalPlayers, baseline.runsCount)
        : null,
      completionRateTrend: baseline
        ? trend(completionRate, baseline.avgCompletionRate, baseline.runsCount)
        : null,

      playerActivity,
      taskFunnel: buildTaskFunnel(stats, hasPriors ? priorRateByTaskId : undefined),
      scoreDistribution: buildScoreDistribution(sessions, tasks.length),
      taskDifficulty,

      topPlayers: buildTopPlayers(sessions),
      aiVerificationStats: aiStatsQuery.data ?? [],
    };
  }

  return {
    data,
    game: gameQuery.data,
    run: runDetail,
    baseline: baselineQuery.data,
    timeline,
    isLoading,
    error,
  };
}
