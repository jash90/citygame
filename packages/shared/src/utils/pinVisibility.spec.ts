import { filterVisibleTasks, type PinCandidate } from './pinVisibility';
import {
  DEFAULT_PIN_REVEAL_DISTANCE_METERS,
  GameFlowType,
} from '../types/game';

const TASK_A = { id: 'a', order: 0, location: { lat: 50.0617, lng: 19.9373 } };
// ~200 m east of A
const TASK_B = { id: 'b', order: 1, location: { lat: 50.0617, lng: 19.9401 } };
// ~700 m south-east of A
const TASK_C = { id: 'c', order: 2, location: { lat: 50.056, lng: 19.945 } };

function ids(tasks: PinCandidate[]): string[] {
  return tasks.map((t) => t.id);
}

describe('filterVisibleTasks', () => {
  it('always shows the first task in order even without player location', () => {
    const visible = filterVisibleTasks({
      tasks: [TASK_A, TASK_B, TASK_C],
      playerLocation: null,
      completedTaskIds: new Set<string>(),
    });
    expect(ids(visible)).toEqual(['a']);
  });

  it('keeps completed pins visible regardless of distance', () => {
    const visible = filterVisibleTasks({
      tasks: [TASK_A, TASK_B, TASK_C],
      playerLocation: { lat: 0, lng: 0 },
      completedTaskIds: new Set(['a']),
      revealDistanceMeters: 100,
    });
    // A is completed → shown. B is the next uncompleted task but player is far → hidden. C is two steps ahead → hidden.
    expect(ids(visible)).toEqual(['a']);
  });

  it('reveals the next task once the previous is completed and the player is within range', () => {
    const visible = filterVisibleTasks({
      tasks: [TASK_A, TASK_B, TASK_C],
      playerLocation: { lat: TASK_B.location.lat, lng: TASK_B.location.lng },
      completedTaskIds: new Set(['a']),
      revealDistanceMeters: 100,
    });
    // A (completed) + B (predecessor done & 0 m away) are visible. C is still two steps away → hidden.
    expect(ids(visible)).toEqual(['a', 'b']);
  });

  it('hides the next task when the predecessor is completed but the player is out of range', () => {
    const visible = filterVisibleTasks({
      tasks: [TASK_A, TASK_B, TASK_C],
      playerLocation: { lat: 50.0617, lng: 19.9373 }, // at A, ~200 m from B
      completedTaskIds: new Set(['a']),
      revealDistanceMeters: 100,
    });
    expect(ids(visible)).toEqual(['a']);
  });

  it('does not skip ahead — task C stays hidden even if the player stands on it while B is incomplete', () => {
    const visible = filterVisibleTasks({
      tasks: [TASK_A, TASK_B, TASK_C],
      playerLocation: { lat: TASK_C.location.lat, lng: TASK_C.location.lng },
      completedTaskIds: new Set(['a']),
      revealDistanceMeters: 100,
    });
    expect(ids(visible)).toEqual(['a']);
  });

  it('uses the default distance when revealDistanceMeters is omitted', () => {
    const visibleAtRange = filterVisibleTasks({
      tasks: [TASK_A, TASK_B],
      playerLocation: { lat: TASK_B.location.lat, lng: TASK_B.location.lng },
      completedTaskIds: new Set(['a']),
    });
    expect(ids(visibleAtRange)).toEqual(['a', 'b']);

    expect(DEFAULT_PIN_REVEAL_DISTANCE_METERS).toBe(100);
  });

  it('respects a custom reveal distance', () => {
    const tight = filterVisibleTasks({
      tasks: [TASK_A, TASK_B],
      // ~200 m from B
      playerLocation: { lat: 50.0617, lng: 19.9373 },
      completedTaskIds: new Set(['a']),
      revealDistanceMeters: 50,
    });
    expect(ids(tight)).toEqual(['a']);

    const loose = filterVisibleTasks({
      tasks: [TASK_A, TASK_B],
      playerLocation: { lat: 50.0617, lng: 19.9373 },
      completedTaskIds: new Set(['a']),
      revealDistanceMeters: 500,
    });
    expect(ids(loose)).toEqual(['a', 'b']);
  });

  it('sorts by order before applying the rules (input order does not matter)', () => {
    const visible = filterVisibleTasks({
      tasks: [TASK_C, TASK_A, TASK_B],
      playerLocation: null,
      completedTaskIds: new Set<string>(),
    });
    expect(ids(visible)).toEqual(['a']);
  });

  it('passes through tasks without a location', () => {
    const noLocTask = { id: 'no-loc', order: 5 } satisfies PinCandidate;
    const visible = filterVisibleTasks({
      tasks: [TASK_A, noLocTask],
      playerLocation: null,
      completedTaskIds: new Set<string>(),
    });
    expect(ids(visible)).toEqual(['a', 'no-loc']);
  });

  it('handles an empty task list', () => {
    expect(
      filterVisibleTasks({
        tasks: [],
        playerLocation: null,
        completedTaskIds: new Set<string>(),
      }),
    ).toEqual([]);
  });

  describe('OPEN_WORLD flow', () => {
    it('reveals every task pin from the start regardless of player location', () => {
      const visible = filterVisibleTasks({
        tasks: [TASK_A, TASK_B, TASK_C],
        playerLocation: null,
        completedTaskIds: new Set<string>(),
        flowType: GameFlowType.OPEN_WORLD,
      });
      expect(ids(visible)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('BRANCHING flow', () => {
    it('reveals a branch task once any source transition is satisfied', () => {
      const transitions = [
        { fromTaskId: null, toTaskId: 'a' },
        { fromTaskId: 'a', toTaskId: 'b' },
        { fromTaskId: 'a', toTaskId: 'c' },
      ];
      const visible = filterVisibleTasks({
        tasks: [TASK_A, TASK_B, TASK_C],
        playerLocation: { lat: TASK_B.location.lat, lng: TASK_B.location.lng },
        completedTaskIds: new Set(['a']),
        revealDistanceMeters: 100,
        flowType: GameFlowType.BRANCHING,
        transitions,
      });
      // A is completed; B's predecessor A is done and player is on B → visible.
      // C's predecessor is also A (branch) and player is far → C hidden.
      expect(ids(visible)).toEqual(['a', 'b']);
    });

    it('hides downstream tasks until their predecessor is completed', () => {
      const transitions = [
        { fromTaskId: null, toTaskId: 'a' },
        { fromTaskId: 'a', toTaskId: 'b' },
        { fromTaskId: 'b', toTaskId: 'c' },
      ];
      const visible = filterVisibleTasks({
        tasks: [TASK_A, TASK_B, TASK_C],
        playerLocation: { lat: TASK_C.location.lat, lng: TASK_C.location.lng },
        completedTaskIds: new Set(['a']),
        revealDistanceMeters: 100,
        flowType: GameFlowType.BRANCHING,
        transitions,
      });
      expect(ids(visible)).toEqual(['a']);
    });
  });

  describe('MIXED flow (hub-and-spoke)', () => {
    it('locks spokes until the hub is completed', () => {
      // Treat A as hub, B and C as spokes whose only incoming edge is A.
      const transitions = [
        { fromTaskId: null, toTaskId: 'a' },
        { fromTaskId: 'a', toTaskId: 'b' },
        { fromTaskId: 'a', toTaskId: 'c' },
      ];
      const visible = filterVisibleTasks({
        tasks: [TASK_A, TASK_B, TASK_C],
        playerLocation: { lat: TASK_B.location.lat, lng: TASK_B.location.lng },
        completedTaskIds: new Set<string>(),
        revealDistanceMeters: 100,
        flowType: GameFlowType.MIXED,
        transitions,
      });
      // A has a start transition → visible (player far is fine: location-less starts always show).
      // Wait — in MIXED with transitions, A's incoming is fromTaskId=null, so reachable=true,
      // but the player must be within range. Here player is on B, far from A.
      // The first-task fallback only fires when no transition data exists.
      expect(ids(visible)).toEqual([]);
    });

    it('reveals spokes after the hub completion (with player nearby)', () => {
      const transitions = [
        { fromTaskId: null, toTaskId: 'a' },
        { fromTaskId: 'a', toTaskId: 'b' },
        { fromTaskId: 'a', toTaskId: 'c' },
      ];
      const visible = filterVisibleTasks({
        tasks: [TASK_A, TASK_B, TASK_C],
        playerLocation: { lat: TASK_B.location.lat, lng: TASK_B.location.lng },
        completedTaskIds: new Set(['a']),
        revealDistanceMeters: 100,
        flowType: GameFlowType.MIXED,
        transitions,
      });
      // A completed → visible. B reachable (A done) and player on B → visible.
      // C reachable (A done) but player far → hidden.
      expect(ids(visible)).toEqual(['a', 'b']);
    });
  });
});
