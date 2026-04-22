import { haversineDistance } from './geo';
import { DEFAULT_PIN_REVEAL_DISTANCE_METERS } from '../types/game';

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Minimal structural shape required to decide pin visibility.
 * Consumers (e.g. the mobile app's richer `Task` type) satisfy this automatically.
 */
export interface PinCandidate {
  id: string;
  order: number;
  location?: Coordinates | null;
}

export interface FilterVisibleTasksArgs<T extends PinCandidate> {
  tasks: T[];
  playerLocation: Coordinates | null;
  completedTaskIds: Set<string> | ReadonlySet<string>;
  revealDistanceMeters?: number;
}

/**
 * Decides which task pins are revealed on the map.
 *
 * Rules:
 * - Completed tasks are always visible (trail of progress).
 * - The first task in order is always visible (the game has to start somewhere).
 * - A later task is visible only when its predecessor is completed AND
 *   the player is within `revealDistanceMeters` of it.
 * - Tasks without a location are always passed through (consumers render them
 *   as null) so missing coordinates can't hide a task's status elsewhere.
 */
export function filterVisibleTasks<T extends PinCandidate>({
  tasks,
  playerLocation,
  completedTaskIds,
  revealDistanceMeters,
}: FilterVisibleTasksArgs<T>): T[] {
  const distance = revealDistanceMeters ?? DEFAULT_PIN_REVEAL_DISTANCE_METERS;
  const ordered = [...tasks].sort((a, b) => a.order - b.order);

  return ordered.filter((task, index) => {
    if (!task.location) return true;

    if (completedTaskIds.has(task.id)) return true;

    if (index === 0) return true;

    const prev = ordered[index - 1];
    if (!prev || !completedTaskIds.has(prev.id)) return false;

    if (!playerLocation) return false;

    const meters = haversineDistance(
      playerLocation.lat,
      playerLocation.lng,
      task.location.lat,
      task.location.lng,
    );
    return meters <= distance;
  });
}
