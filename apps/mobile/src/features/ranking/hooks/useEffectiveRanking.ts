import { useMemo } from 'react';
import { useRankingStore } from '@/features/ranking/stores/rankingStore';
import { useGameStore } from '@/features/game/stores/gameStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { RankEntry } from '@/shared/types/api.types';

export interface EffectiveRanking {
  entries: RankEntry[];
  /** True when the local user's score was overlaid on top of the cached entry. */
  hasLocalOverride: boolean;
  /** Cached server-side rank for the local user (or null). */
  cachedSelfRank: number | null;
  /** Effective rank for the local user after overlay (or null). */
  effectiveSelfRank: number | null;
}

/**
 * Returns the cached ranking with the local user's entry overlaid with their
 * CURRENT in-app score (`session.totalPoints` + `completedTaskIds.size`).
 *
 * Why: tasks completed offline bump `session.totalPoints` immediately via
 * `useTaskMutations` optimistic update, but the cached `RankEntry` for the
 * user is only refreshed after a WS `ranking:update` or REST `/ranking` round
 * trip — both of which require connectivity. Without this overlay the
 * ranking screen tells offline users they have FEWER points than they
 * actually do, which is wrong and confusing.
 *
 * If the local user is not present in the cached entries (e.g. they just
 * joined the game and the snapshot pre-dates them), the synthetic entry
 * is added so they always see themselves on the list.
 */
export function useEffectiveRanking(): EffectiveRanking {
  const cachedEntries = useRankingStore((s) => s.entries);
  const session = useGameStore((s) => s.currentSession);
  const completedTaskIds = useGameStore((s) => s.completedTaskIds);
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    if (!user || !session) {
      return {
        entries: cachedEntries,
        hasLocalOverride: false,
        cachedSelfRank: null,
        effectiveSelfRank: null,
      };
    }

    const cachedSelf = cachedEntries.find((e) => e.userId === user.id) ?? null;
    const localPoints = session.totalPoints;
    const localCompleted = completedTaskIds.size;

    // Cached entry already matches local state — return cached as-is.
    if (
      cachedSelf &&
      cachedSelf.totalPoints === localPoints &&
      cachedSelf.completedTasks === localCompleted
    ) {
      return {
        entries: cachedEntries,
        hasLocalOverride: false,
        cachedSelfRank: cachedSelf.rank,
        effectiveSelfRank: cachedSelf.rank,
      };
    }

    // Build merged list: cached others + synthetic local user.
    const others = cachedEntries.filter((e) => e.userId !== user.id);
    const localEntry: RankEntry = {
      rank: 0, // re-assigned below
      userId: user.id,
      displayName: user.displayName ?? user.email ?? '',
      avatarUrl: cachedSelf?.avatarUrl ?? user.avatarUrl,
      totalPoints: localPoints,
      completedTasks: localCompleted,
    };

    const merged = [...others, localEntry]
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          b.completedTasks - a.completedTasks ||
          a.displayName.localeCompare(b.displayName),
      )
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    const effectiveSelfRank =
      merged.find((e) => e.userId === user.id)?.rank ?? null;

    return {
      entries: merged,
      hasLocalOverride: true,
      cachedSelfRank: cachedSelf?.rank ?? null,
      effectiveSelfRank,
    };
  }, [cachedEntries, user, session, completedTaskIds]);
}
