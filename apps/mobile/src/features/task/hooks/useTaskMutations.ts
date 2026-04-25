import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { gamesApi } from '@/features/game/services/games.api';
import { useGameStore } from '@/features/game/stores/gameStore';
import {
  selectBundle,
  useOfflineBundleStore,
} from '@/features/offline/stores/offlineBundleStore';
import {
  verifyOffline,
  type OfflineVerificationResult,
} from '@/features/offline/services/verifyOffline';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { NetworkError } from '@/shared/services/apiClient';
import { useMutationQueue } from '@/shared/services/mutationQueue';
import type { TaskAttempt } from '@/shared/types/api.types';
import type { TaskSubmission } from '@citygame/shared';

/**
 * Result returned from `useSubmitTask`. Three shapes:
 *  - `queued: false` → the request hit the server, response is canonical
 *  - `queued: true` with `localVerdict` → server unreachable but we ran the
 *    same hashing/distance check the server would; UI shows the verdict and
 *    the queued submit reconciles on reconnect (server is authoritative; if
 *    it disagrees, the queue handler updates the store)
 *  - `queued: true` without `localVerdict` → AI task or unknown task config;
 *    UI shows "awaiting verification"
 */
export type SubmitTaskResult =
  | { queued: false; attempt: TaskAttempt }
  | {
      queued: true;
      clientSubmissionId: string;
      localVerdict?: OfflineVerificationResult;
    };

export const useSubmitTask = () => {
  const { markTaskCompleted } = useGameStore();
  const queryClient = useQueryClient();

  return useMutation<
    SubmitTaskResult,
    Error,
    { gameId: string; taskId: string; submission: TaskSubmission }
  >({
    mutationFn: async ({ gameId, taskId, submission }) => {
      const clientSubmissionId = randomUUID();
      // Pull off the smuggled media-upload dependency before sending anything
      // to the wire — the server has no business seeing client-side ids.
      const { _dependsOn, ...wireSubmission } = submission as Record<string, unknown> & {
        _dependsOn?: string;
      };

      // Offline-first: when a media upload was already queued, never even
      // attempt the online submit. The dependent submit must wait for the
      // upload to land (and its `imageUrl` to be resolved) before being sent.
      if (_dependsOn) {
        useMutationQueue.getState().enqueue({
          kind: 'submit',
          gameId,
          taskId,
          payload: wireSubmission,
          clientSubmissionId,
          dependsOn: _dependsOn,
        });
        return { queued: true, clientSubmissionId };
      }

      try {
        const attempt = await gamesApi.submitTask(
          gameId,
          taskId,
          wireSubmission as TaskSubmission,
          clientSubmissionId,
        );
        return { queued: false, attempt };
      } catch (err) {
        if (!(err instanceof NetworkError)) throw err;

        // Offline path: try to derive a local verdict from the cached bundle
        // so the player gets immediate, accurate feedback for QR/GPS/TEXT/CIPHER
        // tasks. AI tasks resolve to `PENDING` and reconcile on sync.
        const stored = useOfflineBundleStore.getState().bundles[gameId];
        const offlineTask = stored?.bundle.tasks.find((t) => t.id === taskId);
        let localVerdict: OfflineVerificationResult | undefined;
        if (offlineTask) {
          localVerdict = await verifyOffline(offlineTask, wireSubmission);
        }

        useMutationQueue.getState().enqueue({
          kind: 'submit',
          gameId,
          taskId,
          payload: wireSubmission,
          clientSubmissionId,
        });

        // Optimistic completion: only mark CORRECT/PARTIAL locally. INCORRECT
        // verdicts must NOT mark complete — the player can retry. The server
        // will overwrite this on sync if it disagrees.
        if (localVerdict?.status === 'CORRECT' || localVerdict?.status === 'PARTIAL') {
          markTaskCompleted(taskId);
        }

        return { queued: true, clientSubmissionId, localVerdict };
      }
    },
    onSuccess: (result, variables) => {
      if (result.queued) return;
      const attempt = result.attempt;
      if (attempt.status === 'CORRECT' || attempt.status === 'PARTIAL') {
        markTaskCompleted(variables.taskId);
      }
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.GAME(variables.gameId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['progress', variables.gameId],
      });
    },
  });
};

export const useDevComplete = () => {
  const { markTaskCompleted } = useGameStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ gameId, taskId }: { gameId: string; taskId: string }) =>
      gamesApi.devComplete(gameId, taskId),
    onSuccess: (attempt, variables) => {
      markTaskCompleted(variables.taskId);
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.GAME(variables.gameId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['progress', variables.gameId],
      });
    },
  });
};

export interface UnlockResult {
  unlocked: boolean;
  message: string;
  /** True when this verdict came from the local bundle, not the server. */
  offline?: boolean;
}

/**
 * Unlock attempt. Mirrors the server's logic for GPS (haversine vs radius)
 * and QR (plaintext compare) using the offline bundle when there's no
 * connection. The unlock is fire-and-forget for sync purposes — the next
 * `submit` for the same task will trigger a server-side state advance.
 */
export const useUnlockTask = () => {
  const { updateTaskStatus } = useGameStore();

  return useMutation<
    UnlockResult,
    Error,
    {
      gameId: string;
      taskId: string;
      unlockData?: Record<string, unknown>;
    }
  >({
    mutationFn: async ({ gameId, taskId, unlockData }) => {
      try {
        return await gamesApi.unlockTask(gameId, taskId, unlockData);
      } catch (err) {
        if (!(err instanceof NetworkError)) throw err;

        // Replicate the server's unlock-strategy logic locally.
        const stored = useOfflineBundleStore.getState().bundles[gameId];
        const task = stored?.bundle.tasks.find((t) => t.id === taskId);
        if (!task) {
          return { unlocked: false, message: 'Brak danych offline dla tego zadania', offline: true };
        }
        return verifyUnlockOffline(task.unlockMethod, task.unlockConfig, unlockData ?? {});
      }
    },
    onSuccess: (result, variables) => {
      if (result.unlocked) {
        updateTaskStatus(variables.taskId, 'available');
      }
    },
  });
};

export const useHint = () => {
  return useMutation({
    mutationFn: async ({
      gameId,
      taskId,
    }: {
      gameId: string;
      taskId: string;
    }) => {
      try {
        return await gamesApi.useHint(gameId, taskId);
      } catch (err) {
        if (!(err instanceof NetworkError)) throw err;

        // Reveal the next unused hint locally and queue the server-side
        // record for sync (so points are deducted on reconnect).
        const stored = useOfflineBundleStore.getState().bundles[gameId];
        const task = stored?.bundle.tasks.find((t) => t.id === taskId);
        if (!task || task.hints.length === 0) {
          throw err;
        }
        // We don't track hint usage locally yet; reveal hint[0] as a best
        // effort. A future refinement could track usage in gameStore.
        const hint = task.hints[0];

        useMutationQueue.getState().enqueue({
          kind: 'hint',
          gameId,
          taskId,
          payload: {},
          clientSubmissionId: randomUUID(),
        });

        return {
          hint: { content: hint.content, pointPenalty: hint.pointPenalty },
        };
      }
    },
  });
};

function verifyUnlockOffline(
  method: string,
  config: Record<string, unknown>,
  data: Record<string, unknown>,
): UnlockResult {
  if (method === 'NONE') {
    return { unlocked: true, message: 'Zadanie otwarte', offline: true };
  }
  if (method === 'QR') {
    const expected = config.qrCode as string | undefined;
    const scanned = data.code as string | undefined;
    if (!expected || !scanned) {
      return { unlocked: false, message: 'Nieprawidłowy kod QR', offline: true };
    }
    return scanned === expected
      ? { unlocked: true, message: 'Kod QR zaakceptowany — zadanie odblokowane!', offline: true }
      : { unlocked: false, message: 'Nieprawidłowy kod QR', offline: true };
  }
  if (method === 'GPS') {
    const targetLat = config.targetLat as number | undefined;
    const targetLng = config.targetLng as number | undefined;
    const radius = (config.radiusMeters as number | undefined) ?? 50;
    const playerLat = data.latitude as number | undefined;
    const playerLng = data.longitude as number | undefined;
    if (
      targetLat == null ||
      targetLng == null ||
      playerLat == null ||
      playerLng == null
    ) {
      return { unlocked: false, message: 'Brak współrzędnych GPS', offline: true };
    }
    // Inline haversine — copied from @citygame/shared to avoid the import in
    // this file's hot path; the function is small and stable.
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(targetLat - playerLat);
    const dLng = toRad(targetLng - playerLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(playerLat)) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distance > radius) {
      return {
        unlocked: false,
        message: `Musisz być w promieniu ${radius} m od celu (jesteś ${Math.round(distance)} m od niego)`,
        offline: true,
      };
    }
    return {
      unlocked: true,
      message: 'Lokalizacja potwierdzona — zadanie odblokowane!',
      offline: true,
    };
  }
  return { unlocked: false, message: 'Nieznana metoda odblokowania', offline: true };
}
