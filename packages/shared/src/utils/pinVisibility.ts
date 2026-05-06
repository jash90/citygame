import { haversineDistance } from './geo';
import {
  DEFAULT_PIN_REVEAL_DISTANCE_METERS,
  GameFlowType,
} from '../types/game';

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

/**
 * Edge between two tasks, mirroring `TaskTransition` from the shared types
 * (only the fields we need for visibility).
 */
export interface PinTransition {
  fromTaskId: string | null;
  toTaskId: string;
}

export interface FilterVisibleTasksArgs<T extends PinCandidate> {
  tasks: T[];
  playerLocation: Coordinates | null;
  completedTaskIds: Set<string> | ReadonlySet<string>;
  revealDistanceMeters?: number;
  /**
   * Game flow type. Defaults to LINEAR (legacy behaviour). Non-linear flows
   * use `transitions` to decide which task pins are eligible to appear.
   */
  flowType?: GameFlowType;
  transitions?: PinTransition[];
}

/**
 * Decides which task pins are revealed on the map.
 *
 * - LINEAR (default): completed tasks always visible; first task always visible;
 *   later tasks only when their predecessor is complete AND the player is within
 *   `revealDistanceMeters`.
 * - OPEN_WORLD: every task is reachable from start — all pins are visible
 *   (no reveal gating).
 * - BRANCHING / MIXED: a task is reachable when its incoming `TaskTransition`
 *   originates from a completed task (or is a start edge with `fromTaskId === null`).
 *   Reachable tasks still respect `revealDistanceMeters` so pins stay hidden until
 *   the player is close.
 */
export function filterVisibleTasks<T extends PinCandidate>(
  args: FilterVisibleTasksArgs<T>,
): T[] {
  const flowType = args.flowType ?? GameFlowType.LINEAR;

  if (flowType === GameFlowType.OPEN_WORLD) {
    return openWorldVisible(args);
  }
  if (flowType === GameFlowType.BRANCHING || flowType === GameFlowType.MIXED) {
    return graphVisible(args);
  }
  return linearVisible(args);
}

function linearVisible<T extends PinCandidate>({
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

function openWorldVisible<T extends PinCandidate>({ tasks }: FilterVisibleTasksArgs<T>): T[] {
  return [...tasks].sort((a, b) => a.order - b.order);
}

function graphVisible<T extends PinCandidate>({
  tasks,
  playerLocation,
  completedTaskIds,
  revealDistanceMeters,
  transitions = [],
}: FilterVisibleTasksArgs<T>): T[] {
  const distance = revealDistanceMeters ?? DEFAULT_PIN_REVEAL_DISTANCE_METERS;
  const ordered = [...tasks].sort((a, b) => a.order - b.order);

  // A task is "reachable" when it has at least one incoming transition whose
  // source is null (start) OR a completed task. Tasks without any incoming
  // transition fall back to the LINEAR rule (predecessor by order) so a
  // partially-defined graph degrades gracefully.
  const incomingByTask = new Map<string, PinTransition[]>();
  for (const tr of transitions) {
    const list = incomingByTask.get(tr.toTaskId) ?? [];
    list.push(tr);
    incomingByTask.set(tr.toTaskId, list);
  }

  return ordered.filter((task, index) => {
    if (!task.location) return true;
    if (completedTaskIds.has(task.id)) return true;

    const incoming = incomingByTask.get(task.id);
    let reachable: boolean;
    if (incoming && incoming.length) {
      reachable = incoming.some(
        (tr) => tr.fromTaskId === null || completedTaskIds.has(tr.fromTaskId),
      );
    } else {
      // No graph data for this task — fall back to linear ordering.
      if (index === 0) return true;
      const prev = ordered[index - 1];
      reachable = !!prev && completedTaskIds.has(prev.id);
    }

    if (!reachable) return false;
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
