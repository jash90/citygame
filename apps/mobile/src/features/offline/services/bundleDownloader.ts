// `expo-file-system` v19 ships a new Paths/File/Directory API plus a stable
// legacy module exposing the standalone helpers we use here.
import * as FileSystem from 'expo-file-system/legacy';
import { offlineApi } from '@/features/offline/services/offline.api';
import { useOfflineBundleStore } from '@/features/offline/stores/offlineBundleStore';
import {
  deleteMapPack,
  downloadMapPack,
} from '@/features/map/services/mapPackManager';
import type { OfflineBundle } from '@/features/offline/types';

/**
 * Resolve the per-game offline directory under the app sandbox.
 * Files here survive app kills and reinstalls until the user clears storage.
 */
function gameDirFor(gameId: string): string {
  return `${FileSystem.documentDirectory}offline/${gameId}/`;
}

/** Strip query strings + path so the local filename mirrors the remote basename. */
function localNameFor(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop();
    if (last && last.length > 0) return last;
  } catch {
    // fall through to hash-based naming
  }
  // Fallback: stable name derived from the URL itself.
  return url.replace(/[^a-zA-Z0-9.-]+/g, '_').slice(-80);
}

export interface DownloadOfflineBundleOptions {
  /** Skip downloading any media file already present on disk. */
  resume?: boolean;
}

/**
 * Fetch the bundle JSON, persist it, then pre-download every URL listed in
 * `mediaManifest`. Updates `useOfflineBundleStore.status` so UIs can render
 * progress bars off the same source of truth.
 */
export async function downloadOfflineBundle(
  gameId: string,
  options: DownloadOfflineBundleOptions = {},
): Promise<void> {
  const { resume = true } = options;
  const store = useOfflineBundleStore.getState();

  store.setStatus(gameId, {
    kind: 'downloading',
    bytesTotal: null,
    bytesDone: 0,
    mediaTotal: 0,
    mediaDone: 0,
  });

  let bundle: OfflineBundle;
  try {
    bundle = await offlineApi.bundle(gameId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udało się pobrać paczki offline';
    store.setStatus(gameId, { kind: 'error', message });
    throw err;
  }

  store.setBundle(gameId, bundle);

  const dir = gameDirFor(gameId);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);

  const manifest = bundle.mediaManifest;
  let mediaDone = 0;

  for (const remoteUrl of manifest) {
    const localPath = `${dir}${localNameFor(remoteUrl)}`;
    const info = resume ? await FileSystem.getInfoAsync(localPath) : { exists: false };
    if (!info.exists) {
      try {
        await FileSystem.downloadAsync(remoteUrl, localPath);
      } catch {
        // A single missing media URL must not abort the bundle download —
        // the player can still play the game; only that asset will fall back
        // to the remote URL (which itself fails offline, so the UI shows a
        // placeholder).
        continue;
      }
    }
    useOfflineBundleStore.getState().setMediaCacheEntry(gameId, remoteUrl, localPath);
    mediaDone += 1;
    store.setStatus(gameId, {
      kind: 'downloading',
      bytesTotal: null,
      bytesDone: 0,
      mediaTotal: manifest.length,
      mediaDone,
    });
  }

  // Map tile pack — must come last because it can be the slowest step.
  // Failure here doesn't abort the bundle; the player can still play with
  // a blank/fallback map style if tiles aren't available.
  try {
    await downloadMapPack(gameId, bundle.tasks);
  } catch {
    // logged by mapPackManager
  }

  store.setStatus(gameId, {
    kind: 'ready',
    downloadedAt: new Date().toISOString(),
  });
}

/** Wipe the on-disk media + map pack for a downloaded bundle and clear the store entry. */
export async function deleteOfflineBundle(gameId: string): Promise<void> {
  const dir = gameDirFor(gameId);
  await FileSystem.deleteAsync(dir, { idempotent: true });
  await deleteMapPack(gameId).catch(() => undefined);
  useOfflineBundleStore.getState().remove(gameId);
}

/**
 * Resolve a remote URL to a local file URI if it has been pre-downloaded for
 * the given game; otherwise return the original URL. UI components should
 * call this for every image/video they render so they degrade gracefully when
 * online and use cached assets when offline.
 */
export function resolveMediaUrl(gameId: string, remoteUrl: string): string {
  const stored = useOfflineBundleStore.getState().bundles[gameId];
  if (!stored) return remoteUrl;
  return stored.mediaCache[remoteUrl] ?? remoteUrl;
}
