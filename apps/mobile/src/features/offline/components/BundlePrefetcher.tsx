import { useEffect, useRef } from 'react';
import { useGames } from '@/features/game/hooks/useGameQueries';
import { useIsOnline } from '@/shared/providers/NetworkProvider';
import { checkBundleFreshness } from '@/features/offline/services/bundleDownloader';
import { useOfflineBundleStore } from '@/features/offline/stores/offlineBundleStore';

/**
 * Throttle window between prefetch passes. The prefetcher walks the entire
 * games list, so we don't want it firing on every render — once every 10 min
 * is plenty.
 */
const PREFETCH_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Headless component: when the player is online, eagerly download offline
 * bundles for every visible game (not just the one they're actively
 * playing). Without this only the currently joined game gets cached on
 * `BundleFreshnessGuard`'s probe path, so a player who goes offline and
 * then tries to switch to a different game has no data to fall back on.
 *
 * Throttled to one pass per `PREFETCH_THROTTLE_MS` and skips games whose
 * bundle is already cached + ready (`checkBundleFreshness` does the
 * version probe in that case which is cheap).
 */
export const BundlePrefetcher = (): null => {
  const isOnline = useIsOnline();
  const { data: games } = useGames();
  const lastPassAt = useRef(0);

  useEffect(() => {
    if (!isOnline) return;
    if (!games || games.length === 0) return;
    const now = Date.now();
    if (now - lastPassAt.current < PREFETCH_THROTTLE_MS) return;
    lastPassAt.current = now;

    void runPass(games.map((g) => g.id));
  }, [isOnline, games]);

  return null;
};

async function runPass(gameIds: string[]): Promise<void> {
  // Sequential, not parallel: each download is a JSON fetch + N media
  // downloads, doing them in parallel would saturate the network on a
  // mobile connection. Failures are swallowed per-game; a stuck media URL
  // on game A must not block game B.
  for (const gameId of gameIds) {
    const stored = useOfflineBundleStore.getState().bundles[gameId];
    if (stored?.status.kind === 'downloading') continue;
    try {
      await checkBundleFreshness(gameId);
    } catch {
      // Per-game failure already surfaces in the store status — keep going.
    }
  }
}
