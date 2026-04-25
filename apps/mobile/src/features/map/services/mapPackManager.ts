import { OfflineManager } from '@maplibre/maplibre-react-native';
import { MAP_STYLE_URL } from '@/shared/lib/constants';
import type { OfflineBundleTask } from '@/features/offline/types';

const PACK_PREFIX = 'citygame:';

interface MapPackBounds {
  northEast: [number, number]; // [lng, lat]
  southWest: [number, number]; // [lng, lat]
}

interface MapPackOptions {
  minZoom: number;
  maxZoom: number;
  /** Padding around the task bounding box, in degrees. ~0.005° ≈ 500m. */
  padding: number;
}

const DEFAULT_OPTIONS: MapPackOptions = {
  minZoom: 12,
  maxZoom: 16,
  padding: 0.005,
};

function packNameFor(gameId: string): string {
  return `${PACK_PREFIX}${gameId}`;
}

/**
 * Compute a tight bounding box around all task locations, padded so the
 * pack covers a bit of context beyond the play area.
 */
export function boundsForTasks(
  tasks: Pick<OfflineBundleTask, 'latitude' | 'longitude'>[],
  padding = DEFAULT_OPTIONS.padding,
): MapPackBounds | null {
  if (tasks.length === 0) return null;
  let minLat = +Infinity;
  let maxLat = -Infinity;
  let minLng = +Infinity;
  let maxLng = -Infinity;
  for (const t of tasks) {
    if (t.latitude < minLat) minLat = t.latitude;
    if (t.latitude > maxLat) maxLat = t.latitude;
    if (t.longitude < minLng) minLng = t.longitude;
    if (t.longitude > maxLng) maxLng = t.longitude;
  }
  return {
    northEast: [maxLng + padding, maxLat + padding],
    southWest: [minLng - padding, minLat - padding],
  };
}

/**
 * Download (or refresh) the offline tile pack for a game. MapLibre's native
 * OfflineManager handles persistence + resume; we just hand it the bounds
 * derived from the task list.
 *
 * Idempotent: if a pack with this name already exists it is reused (caller
 * can call `deleteMapPack` first to force a fresh download).
 */
export async function downloadMapPack(
  gameId: string,
  tasks: Pick<OfflineBundleTask, 'latitude' | 'longitude'>[],
  options: Partial<MapPackOptions> = {},
  onProgress?: (percentage: number) => void,
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const bounds = boundsForTasks(tasks, opts.padding);
  if (!bounds) return;

  const packName = packNameFor(gameId);
  const existing = await OfflineManager.getPack(packName);
  if (existing) return;

  await OfflineManager.createPack(
    {
      name: packName,
      styleURL: MAP_STYLE_URL,
      minZoom: opts.minZoom,
      maxZoom: opts.maxZoom,
      bounds: [bounds.northEast, bounds.southWest],
    },
    (_pack, status) => {
      onProgress?.(status.percentage);
    },
    (_pack, err) => {
      // Errors are logged by MapLibre; surface to the caller via thrown
      // promise rejection on createPack itself when fatal.
      // eslint-disable-next-line no-console
      console.warn(`[mapPack] ${packName} error: ${err.message}`);
    },
  );
}

/** Remove the offline pack for a game. */
export async function deleteMapPack(gameId: string): Promise<void> {
  await OfflineManager.deletePack(packNameFor(gameId));
}
