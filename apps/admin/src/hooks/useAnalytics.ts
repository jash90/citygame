'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi, type GameStats } from '@/lib/api';
import type { Game, Task, GameSession } from '@citygame/shared';

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

// ─── Mock data generators ─────────────────────────────────────────────────────

/**
 * Generates realistic-looking player activity data seeded from stats.
 * Used when the backend doesn't return per-day time-series.
 */
function generatePlayerActivity(
  stats: GameStats,
  period: AnalyticsPeriod,
): PlayerActivityDataPoint[] {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 14;
  const baseCompletions = stats.totalTaskCompletions;
  const totalSessions = stats.totalSessions || 3;

  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));

    // Weight recent days higher — activity tapers off further back
    const weight = 0.4 + (i / days) * 0.6;
    const seed = (i * 7 + 3) % 11; // deterministic pseudo-variation
    const players = Math.max(1, Math.round(totalSessions * weight * (0.7 + (seed / 11) * 0.6)));
    const completions = Math.max(0, Math.round((baseCompletions / days) * weight * (0.8 + (seed / 11) * 0.4)));

    return {
      date: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
      players,
      completions,
    };
  });
}

/**
 * Generates task funnel data from a task list with mock drop-off pattern.
 */
function generateTaskFunnel(
  tasks: Task[],
  totalPlayers: number,
): TaskFunnelDataPoint[] {
  if (tasks.length === 0) return [];

  return tasks.map((task, index) => {
    // Exponential decay — each task loses ~15% of prior completions
    const decayFactor = Math.pow(0.85, index);
    const noise = (((index * 13 + 7) % 10) - 5) * 0.02; // ±10% noise
    const completions = Math.max(0, Math.round(totalPlayers * decayFactor * (1 + noise)));

    return {
      taskTitle: task.title.length > 18 ? task.title.slice(0, 16) + '…' : task.title,
      completions,
      totalPlayers,
    };
  });
}

/**
 * Generates score distribution histogram buckets.
 */
function generateScoreDistribution(
  completedSessions: number,
  tasksCount: number,
): ScoreDistributionDataPoint[] {
  const maxPossibleScore = tasksCount * 100;
  const bucketSize = Math.max(50, Math.ceil(maxPossibleScore / 8));
  const buckets: ScoreDistributionDataPoint[] = [];

  for (let start = 0; start * bucketSize < maxPossibleScore; start++) {
    const low = start * bucketSize;
    const high = (start + 1) * bucketSize;
    // Bell-curve-ish distribution centered around 55% of max
    const center = maxPossibleScore * 0.55;
    const distance = Math.abs((low + high) / 2 - center);
    const sigma = maxPossibleScore * 0.25;
    const density = Math.exp(-(distance * distance) / (2 * sigma * sigma));
    const count = Math.max(0, Math.round(completedSessions * density * 1.8));

    buckets.push({ range: `${low}–${high}`, count });
  }

  return buckets;
}

/**
 * Generates task difficulty data with deterministic variation per task index.
 */
function generateTaskDifficulty(tasks: Task[]): TaskDifficultyDataPoint[] {
  return tasks.map((task, index) => {
    // Some tasks are inherently harder — use index-based seeding
    const seed = (index * 5 + 2) % 7;
    const base = 1.0 + (seed / 6) * 2.5; // 1.0 – 3.5 range
    const avgAttempts = parseFloat(base.toFixed(1));
    const avgTimeSec = 60 + seed * 45 + index * 20;

    return {
      taskTitle: task.title.length > 22 ? task.title.slice(0, 20) + '…' : task.title,
      avgAttempts,
      avgTimeSec,
    };
  });
}

/**
 * Generates mock top players from session data.
 * GameSession has totalPoints, startedAt, completedAt — no playerName or completedTaskCount.
 * Falls back to mock data when sessions are empty (demo mode).
 */
function generateTopPlayers(
  sessions: GameSession[],
  tasksCount: number,
): TopPlayer[] {
  if (sessions.length === 0) {
    // Fallback mock data for Kraków game (3 players)
    return [
      { rank: 1, name: 'Anna K.', score: tasksCount * 92, tasksCompleted: tasksCount, timeMinutes: 48, lastActive: 'Dziś' },
      { rank: 2, name: 'Marek W.', score: tasksCount * 80, tasksCompleted: tasksCount - 1, timeMinutes: 61, lastActive: 'Wczoraj' },
      { rank: 3, name: 'Zofia P.', score: tasksCount * 67, tasksCompleted: tasksCount - 2, timeMinutes: 74, lastActive: '3 dni temu' },
    ];
  }

  const mockNames = ['Anna K.', 'Marek W.', 'Zofia P.', 'Piotr N.', 'Ewa S.', 'Jan M.', 'Katarzyna B.'];

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
        name: mockNames[index % mockNames.length] ?? `Gracz ${index + 1}`,
        score: session.totalPoints ?? 0,
        // Estimate completed tasks from score / avg points per task
        tasksCompleted: Math.min(tasksCount, Math.round((session.totalPoints ?? 0) / Math.max(1, (tasksCount * 80) / tasksCount))),
        timeMinutes: durationMs > 0 ? Math.round(durationMs / 60_000) : 0,
        lastActive: session.completedAt
          ? new Date(session.completedAt).toLocaleDateString('pl-PL')
          : new Date(session.startedAt).toLocaleDateString('pl-PL'),
      };
    });
}

/**
 * Generates AI verification stats from tasks list.
 */
function generateAIVerificationStats(tasks: Task[]): AIVerificationStat[] {
  return tasks.map((task, index) => {
    const seed = (index * 3 + 1) % 10;
    const evaluations = 5 + seed * 3;
    const avgScore = 70 + seed * 2.5;
    const errorRate = (seed % 4) * 1.5;

    return {
      taskName: task.title.length > 30 ? task.title.slice(0, 28) + '…' : task.title,
      evaluations,
      avgScore: parseFloat(avgScore.toFixed(1)),
      errorRate: parseFloat(errorRate.toFixed(1)),
    };
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface RawAnalyticsData {
  game: Game & { tasks: Task[] };
  stats: GameStats;
  sessions: GameSession[];
}

function transformToAnalytics(
  raw: RawAnalyticsData,
  period: AnalyticsPeriod,
): AnalyticsData {
  const { game, stats, sessions } = raw;
  const tasks = game.tasks ?? [];
  const totalPlayers = stats.totalSessions;
  const completedSessions = stats.completedSessions;
  const completionRate =
    totalPlayers > 0 ? Math.round((completedSessions / totalPlayers) * 100) : 0;

  const sortedSessions = [...sessions].sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));
  const totalScore = sortedSessions.reduce((sum, s) => sum + (s.totalPoints ?? 0), 0);
  const averageScore =
    completedSessions > 0 ? Math.round(totalScore / Math.max(completedSessions, 1)) : 0;
  const averageTimeMinutes = stats.averageCompletionTimeSec
    ? Math.round(stats.averageCompletionTimeSec / 60)
    : 0;

  return {
    totalPlayers,
    completionRate,
    averageScore,
    averageTimeMinutes,
    // Trends — placeholder values; extend when backend exposes historical comparison
    playersTrend: 12,
    completionRateTrend: -3,

    playerActivity: generatePlayerActivity(stats, period),
    taskFunnel: generateTaskFunnel(tasks, totalPlayers),
    scoreDistribution: generateScoreDistribution(completedSessions, tasks.length),
    taskDifficulty: generateTaskDifficulty(tasks),

    topPlayers: generateTopPlayers(sortedSessions, tasks.length),
    aiVerificationStats: generateAIVerificationStats(tasks),
  };
}

export function useAnalytics(gameId: string, period: AnalyticsPeriod) {
  const gameQuery = useQuery({
    queryKey: ['admin-game', gameId],
    queryFn: () => adminApi.getGame(gameId),
    staleTime: 60_000,
  });

  const statsQuery = useQuery({
    queryKey: ['analytics', gameId, 'stats'],
    queryFn: () => adminApi.getGameStats(gameId),
    staleTime: 30_000,
  });

  const sessionsQuery = useQuery({
    queryKey: ['analytics', gameId, 'sessions'],
    queryFn: () => adminApi.getGameSessions(gameId),
    staleTime: 30_000,
  });

  const isLoading =
    gameQuery.isLoading || statsQuery.isLoading || sessionsQuery.isLoading;
  const error = gameQuery.error ?? statsQuery.error ?? sessionsQuery.error;

  const data =
    gameQuery.data && statsQuery.data
      ? transformToAnalytics(
          {
            game: gameQuery.data,
            stats: statsQuery.data,
            sessions: sessionsQuery.data ?? [],
          },
          period,
        )
      : null;

  return {
    data,
    game: gameQuery.data,
    isLoading,
    error,
  };
}
