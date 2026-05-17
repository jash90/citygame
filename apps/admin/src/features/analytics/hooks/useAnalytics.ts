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
import type {
  AnalyticsData,
  AnalyticsPeriod,
  RunOption,
} from './useAnalytics.types';

export type {
  AnalyticsData,
  AnalyticsPeriod,
  PlayerActivityDataPoint,
  TaskFunnelDataPoint,
  ScoreDistributionDataPoint,
  TaskDifficultyDataPoint,
  TopPlayer,
  AIVerificationStat,
  RunOption,
} from './useAnalytics.types';

function periodToDays(period: AnalyticsPeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case 'all': return 365;
  }
}

export function useAnalytics(gameId: string, period: AnalyticsPeriod, runId?: string) {
  const gameQuery = useQuery({
    queryKey: ['admin-game', gameId],
    queryFn: () => adminApi.getGame(gameId),
    staleTime: 60_000,
  });

  const runsQuery = useQuery({
    queryKey: ['analytics', gameId, 'runs'],
    queryFn: () => adminApi.getGameRuns(gameId),
    staleTime: 60_000,
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

  const activityQuery = useQuery({
    queryKey: ['analytics', gameId, 'activity', period, runId],
    queryFn: () => adminApi.getPlayerActivity(gameId, periodToDays(period), runId),
    staleTime: 30_000,
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
    gameQuery.isLoading || statsQuery.isLoading || sessionsQuery.isLoading ||
    activityQuery.isLoading || difficultyQuery.isLoading || aiStatsQuery.isLoading;

  const error =
    gameQuery.error ?? statsQuery.error ?? sessionsQuery.error ??
    activityQuery.error ?? difficultyQuery.error ?? aiStatsQuery.error;

  let data: AnalyticsData | null = null;

  if (gameQuery.data && statsQuery.data) {
    const stats = statsQuery.data;
    const sessions = (sessionsQuery.data ?? []) as AdminGameSession[];
    const tasks = gameQuery.data.tasks ?? [];

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

    const taskDifficulty = (difficultyQuery.data ?? []).map((d) => ({
      taskTitle: truncate(d.taskTitle, 22),
      avgAttempts: d.avgAttempts,
      avgTimeSec: d.avgTimeSec,
    }));

    data = {
      totalPlayers,
      completionRate,
      averageScore,
      averageTimeMinutes,
      // Aggregate view has no canonical baseline — keep trend hidden.
      playersTrend: null,
      completionRateTrend: null,

      playerActivity,
      taskFunnel: buildTaskFunnel(stats),
      scoreDistribution: buildScoreDistribution(sessions, tasks.length),
      taskDifficulty,

      topPlayers: buildTopPlayers(sessions),
      aiVerificationStats: aiStatsQuery.data ?? [],
    };
  }

  const runs: RunOption[] = (runsQuery.data ?? []).map((r) => ({
    id: r.id,
    runNumber: r.runNumber,
    status: r.status,
    sessionCount: r._count?.sessions ?? 0,
  }));

  return {
    data,
    game: gameQuery.data,
    runs,
    isLoading,
    error,
  };
}
