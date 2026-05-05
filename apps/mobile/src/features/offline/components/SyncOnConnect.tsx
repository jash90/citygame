import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useIsOnline } from '@/shared/providers/NetworkProvider';
import { SyncRunner } from '@/features/offline/services/syncService';
import { QUERY_KEYS } from '@/shared/lib/constants';

/**
 * Headless component: drains the mutation queue whenever the app becomes
 * usable. Mounted once at the root layout, never renders anything.
 *
 * Triggers:
 *  - online transition (offline → online)
 *  - foreground transition (background → active)
 *  - on initial mount, if already online + active
 *
 * After every successful flush we invalidate the affected game's `progress`
 * and `ranking` queries. Without this, `gameStore.session.totalPoints` and
 * the leaderboard cache stay stale until the next 30 s `refetchInterval`,
 * so the player keeps seeing the "Twój wynik czeka na synchronizację"
 * hint and the old score even though the server has already accepted
 * the submission.
 */
export const SyncOnConnect = (): null => {
  const isOnline = useIsOnline();
  const wasOnline = useRef(isOnline);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Online transition.
    if (isOnline && !wasOnline.current) {
      void runFlush(queryClient);
    }
    wasOnline.current = isOnline;
  }, [isOnline, queryClient]);

  useEffect(() => {
    // Initial flush — covers cold starts where we boot already online.
    // Intentionally runs only on mount; later transitions are handled by the
    // other two effects.
    if (isOnline && AppState.currentState === 'active') {
      void runFlush(queryClient);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev !== 'active' && next === 'active' && isOnline) {
        void runFlush(queryClient);
      }
    });
    return () => sub.remove();
  }, [isOnline, queryClient]);

  return null;
};

/**
 * Run a flush and invalidate per-game `progress` + `ranking` caches for any
 * game whose batch landed (at least one item was OK). React Query's refetch
 * triggers `useProgress`'s queryFn, which calls `gameStore.updateProgress(...)`,
 * which in turn updates `session.totalPoints` and `completedTaskIds`. The
 * ranking screen's own `setRanking(rankingData)` effect picks up the fresh
 * server-side leaderboard, dropping the local-override hint.
 */
async function runFlush(queryClient: QueryClient): Promise<void> {
  const summary = await SyncRunner.flush();
  if (summary.affectedGameIds.size === 0) return;
  for (const gameId of summary.affectedGameIds) {
    void queryClient.invalidateQueries({ queryKey: ['progress', gameId] });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RANKING(gameId) });
  }
}
