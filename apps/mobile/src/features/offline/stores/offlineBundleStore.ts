import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvZustandStorage } from '@/shared/lib/storage/mmkv';
import type { DownloadStatus, OfflineBundle, StoredOfflineBundle } from '@/features/offline/types';

interface OfflineBundleState {
  bundles: Record<string, StoredOfflineBundle>;

  setBundle: (gameId: string, bundle: OfflineBundle) => void;
  setStatus: (gameId: string, status: DownloadStatus) => void;
  setMediaCacheEntry: (gameId: string, remoteUrl: string, localPath: string) => void;
  remove: (gameId: string) => void;
}

const idleStatus: DownloadStatus = { kind: 'idle' };

export const useOfflineBundleStore = create<OfflineBundleState>()(
  persist(
    (set) => ({
      bundles: {},

      setBundle: (gameId, bundle) =>
        set((state) => {
          const existing = state.bundles[gameId];
          return {
            bundles: {
              ...state.bundles,
              [gameId]: {
                bundle,
                mediaCache: existing?.mediaCache ?? {},
                status: existing?.status ?? idleStatus,
              },
            },
          };
        }),

      setStatus: (gameId, status) =>
        set((state) => {
          const existing = state.bundles[gameId];
          if (!existing) return state;
          return {
            bundles: {
              ...state.bundles,
              [gameId]: { ...existing, status },
            },
          };
        }),

      setMediaCacheEntry: (gameId, remoteUrl, localPath) =>
        set((state) => {
          const existing = state.bundles[gameId];
          if (!existing) return state;
          return {
            bundles: {
              ...state.bundles,
              [gameId]: {
                ...existing,
                mediaCache: { ...existing.mediaCache, [remoteUrl]: localPath },
              },
            },
          };
        }),

      remove: (gameId) =>
        set((state) => {
          const next = { ...state.bundles };
          delete next[gameId];
          return { bundles: next };
        }),
    }),
    {
      name: 'citygame.offline-bundles',
      version: 1,
      storage: createJSONStorage(() => mmkvZustandStorage),
    },
  ),
);

/** Selector: lookup a single bundle by game id. */
export const selectBundle =
  (gameId: string) =>
  (state: OfflineBundleState): StoredOfflineBundle | undefined =>
    state.bundles[gameId];
