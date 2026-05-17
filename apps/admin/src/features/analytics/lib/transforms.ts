import type { GameSession } from '@citygame/shared';
import type { GameStats } from '@/shared/lib/admin-api';
import type {
  ScoreDistributionDataPoint,
  TaskFunnelDataPoint,
  TopPlayer,
} from '../hooks/useAnalytics.types';

/** Session enriched with admin-only joins (user, gameRun, attempts count). */
export interface AdminGameSession extends GameSession {
  user: {
    id: string;
    displayName: string | null;
    avatarUrl?: string | null;
    email?: string;
  };
  gameRun?: { runNumber: number; status: string };
  _count: { attempts: number };
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 2) + '…' : text;
}

export function buildTaskFunnel(
  stats: GameStats,
  priorByTaskId?: Map<string, number>,
): TaskFunnelDataPoint[] {
  if (!stats.taskCompletionRates?.length) return [];

  return stats.taskCompletionRates.map((r) => ({
    taskTitle: truncate(r.title, 18),
    completions: r.completedCount,
    totalPlayers: stats.totalSessions,
    priorCompletionRate: priorByTaskId?.get(r.taskId),
  }));
}

export function buildScoreDistribution(
  sessions: AdminGameSession[],
  tasksCount: number,
): ScoreDistributionDataPoint[] {
  const scored = sessions.filter((s) => (s.totalPoints ?? 0) > 0);
  if (scored.length === 0 || tasksCount === 0) return [];

  const maxPossibleScore = tasksCount * 100;
  const bucketSize = Math.max(50, Math.ceil(maxPossibleScore / 8));
  const buckets = new Map<string, number>();

  for (let start = 0; start * bucketSize < maxPossibleScore; start++) {
    const low = start * bucketSize;
    const high = (start + 1) * bucketSize;
    buckets.set(`${low}–${high}`, 0);
  }

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

export function buildTopPlayers(sessions: AdminGameSession[]): TopPlayer[] {
  if (sessions.length === 0) return [];

  return [...sessions]
    .sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
    .slice(0, 10)
    .map((session, index) => {
      const durationMs =
        session.completedAt && session.startedAt
          ? new Date(session.completedAt).getTime() -
            new Date(session.startedAt).getTime()
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
