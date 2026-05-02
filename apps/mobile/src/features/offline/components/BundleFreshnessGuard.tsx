import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsOnline } from '@/shared/providers/NetworkProvider';
import { useGameStore } from '@/features/game/stores/gameStore';
import { checkBundleFreshness } from '@/features/offline/services/bundleDownloader';

/**
 * Throttle window between freshness probes for the same game id. Five minutes
 * is comfortably below typical play sessions (~30–60 min) but long enough that
 * tab switches don't spam the server.
 */
const PROBE_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Headless component: while a game session is active and the client is online,
 * compares the cached `bundleVersion` against the server and re-downloads the
 * offline bundle if the server's copy moved on. Mounted once at the root.
 *
 * Triggers a probe:
 *  - on mount (covers cold starts mid-session)
 *  - on online transition (offline → online)
 *  - on background → active transition
 *  - when `currentGame.id` changes (player switched games)
 *
 * Probes are throttled per game id to one per `PROBE_THROTTLE_MS`. Failures
 * (network, 404, etc.) are swallowed — the player keeps the cached bundle.
 */
export const BundleFreshnessGuard = (): null => {
  const isOnline = useIsOnline();
  const gameId = useGameStore((s) => s.currentGame?.id ?? null);
  const lastProbeAt = useRef<Map<string, number>>(new Map());
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isOnline || !gameId) return;
    void runProbe(gameId, lastProbeAt.current);
  }, [isOnline, gameId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev !== 'active' && next === 'active' && isOnline && gameId) {
        void runProbe(gameId, lastProbeAt.current);
      }
    });
    return () => sub.remove();
  }, [isOnline, gameId]);

  return null;
};

async function runProbe(
  gameId: string,
  lastProbeAt: Map<string, number>,
): Promise<void> {
  const now = Date.now();
  const last = lastProbeAt.get(gameId) ?? 0;
  if (now - last < PROBE_THROTTLE_MS) return;
  lastProbeAt.set(gameId, now);
  await checkBundleFreshness(gameId);
}
