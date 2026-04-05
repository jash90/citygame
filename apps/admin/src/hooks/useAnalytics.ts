'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi, type GameStats } from '@/lib/api';
import type { GameSession } from '@citygame/shared';

export type AnalyticsPeriod = '7d' | '30d' | 'all';

// ─── Chart data shapes ────────────────────────────────────────────────────────

export interface PlayerActivityDataPoint {
  date: string;
  players: number;
  completions: number;
}

export interface TaskFunnelDataPoint {
  taskTitle: string;
  completions: number;
  totalPlayers: number;
}

export interface ScoreDistributionDataPoint {
  range: string;
  count: number;
}

export interface TaskDifficultyDataPoint {
  taskTitle: string;
  avgAttempts: number;
  avgTimeSec: number;
}

export interface TopPlayer {
  rank: number;
  name: string;
  score: number;
  tasksCompleted: number;
  timeMinutes: number;
  lastActive: string;
}

export interface AIVerificationStat {
  taskName: string;
  evaluations: number;
  avgScore: number;
  errorRate: number;
}

export interface AnalyticsData {
  // Summary metrics
  totalPlayers: number;
  completionRate: number;
  averageScore: number;
  averageTimeMinutes: number;
  playersTrend: number;
  completionRateTrend: number;

  // Charts
  playerActivity: PlayerActivityDataPoint[];
  taskFunnel: TaskFunnelDataPoint[];
  scoreDistribution: ScoreDistributionDataPoint[];
  taskDifficulty: TaskDifficultyDataPoint[];

  // Tables
  topPlayers: TopPlayer[];
  aiVerificationStats: AIVerificationStat[];
}

export type RunOption = { id: string; runNumber: number; status: string; sessionCount: number };

// ─── Real data transforms ────────────────────────────────────────────────────

/** Session data enriched with user info from the admin API. */
interface AdminGameSession extends GameSession {
  user: { id: string; displayName: string | null; avatarUrl?: string | null; email?: string };
  gameRun?: { runNumber: number; status: string };
  _count: { attempts: number };
}

function periodToDays(period: AnalyticsPeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case 'all': return 365;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 2) + '…' : text;
}

function buildTaskFunnel(
  stats: GameStats,
): TaskFunnelDataPoint[] {
  if (!stats.taskCompletionRates?.length) return [];

  return stats.taskCompletionRates.map((r) => ({
    taskTitle: truncate(r.title, 18),
    completions: r.completedCount,
    totalPlayers: stats.totalSessions,
  }));
}

function buildScoreDistribution(
  sessions: AdminGameSession[],
  tasksCount: number,
): ScoreDistributionDataPoint[] {
  const scored = sessions.filter((s) => (s.totalPoints ?? 0) > 0);
  if (scored.length === 0 || tasksCount === 0) return [];

  const maxPossibleScore = tasksCount * 100;
  const bucketSize = Math.max(50, Math.ceil(maxPossibleScore / 8));
  const buckets = new Map<string, number>();

  // Initialize buckets
  for (let start = 0; start * bucketSize < maxPossibleScore; start++) {
    const low = start * bucketSize;
    const high = (start + 1) * bucketSize;
    buckets.set(`${low}–${high}`, 0);
  }

  // Place each session in a bucket
  for (const s of scored) {
    const pts = s.totalPoints ?? 0;
    const bucketIndex = Math.min(
      Math.floor(pts / bucketSize),
      Math.ceil(maxPossibleScore / bucketSize) - 1,
    );
    const low = bucketIndex * bucketSize;
    const high = (bucketIndex + 1) * bucketSize;
    const key = `${low}–${high}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([range, count]) => ({ range, count }));
}

function buildTopPlayers(
  sessions: AdminGameSession[],
): TopPlayer[] {
  if (sessions.length === 0) return [];

  return [...sessions]
    .sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
    .slice(0, 10)
    .map((session, index) => {
      const durationMs =
        session.completedAt && session.startedAt
          ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
          : 0;

      return {
        rank: index + 1,
        name: session.user?.displayName ?? 'Gracz',
        score: session.totalPoints ?? 0,
        tasksCompleted: session._count?.attempts ?? 0,
        timeMinutes: durationMs > 0 ? Math.round(durationMs / 60_000) : 0,
        lastActive: session.completedAt
          ? new Date(session.completedAt).toLocaleDateString('pl-PL')
          : new Date(session.startedAt).toLocaleDateString('pl-PL'),
      };
    });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

    // Compute average time from completed sessions
    let averageTimeMinutes = 0;
    if (completedSessionsList.length > 0) {
      const totalMs = completedSessionsList.reduce((sum, s) => {
        const ms = new Date(s.completedAt!).getTime() - new Date(s.startedAt).getTime();
        return sum + Math.max(0, ms);
      }, 0);
      averageTimeMinutes = Math.round(totalMs / completedSessionsList.length / 60_000);
    }

    // Format activity dates for display
    const playerActivity = (activityQuery.data ?? []).map((d) => ({
      date: new Date(d.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
      players: d.players,
      completions: d.completions,
    }));

    // Task difficulty: map to chart shape
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
      playersTrend: 0,
      completionRateTrend: 0,

      playerActivity,
      taskFunnel: buildTaskFunnel(stats),
      scoreDistribution: buildScoreDistribution(sessions, tasks.length),
      taskDifficulty,

      topPlayers: buildTopPlayers(sessions),
      aiVerificationStats: aiStatsQuery.data ?? [],
    };
  }

  // Build run options for the selector
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
