'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type {
  BlueprintCipherAssignment,
  BlueprintEnding,
  BlueprintInput,
  BlueprintOutline,
  BlueprintTask,
  BlueprintTransition,
  GameBlueprint,
  StoryBible,
} from '@citygame/shared';
import { api } from '@/shared/lib/api';
import {
  composeBlueprint,
  composePartialBlueprint,
  type OrchestratorData,
} from '../lib/composeBlueprint';
import {
  hashBlueprintInput,
  readPersisted,
  useDebouncedPersist,
  type PersistedEntry,
} from './useBlueprintPersistence';

/**
 * Per-POI concurrency cap. OpenRouter has account-wide concurrency limits;
 * 5+ in flight backpressures hard with 429s. 3 keeps us safe and still
 * delivers a ~3× speedup over sequential — easy to tune in one place.
 */
const MAX_PARALLEL_POI_CALLS = 3;

/** Per-stage timeout passed to the api client (in ms). */
const STAGE_TIMEOUT_MS = 240_000; // 4 min — matches the slowest single stage on gpt-5

export type StageKey =
  | 'research'
  | 'bible'
  | 'outline'
  | 'transitions'
  | 'endings';

export type StageStatus = 'idle' | 'pending' | 'ok' | 'error' | 'skipped';

export interface OrchestratorState {
  inputHash: string;
  input: BlueprintInput;
  stages: {
    research: StageStatus;
    bible: StageStatus;
    outline: StageStatus;
    tasks: Record<number, StageStatus>;
    tasksOverall: 'idle' | 'pending' | 'ok' | 'error';
    transitions: StageStatus;
    endings: StageStatus;
  };
  data: {
    researchPack?: string | null;
    bible?: StoryBible;
    outline?: BlueprintOutline;
    cipherPlan?: Record<number, BlueprintCipherAssignment>;
    tasks: Record<number, BlueprintTask>;
    transitions?: BlueprintTransition[];
    endings?: BlueprintEnding[];
  };
  errors: Partial<Record<string, { message: string }>>;
  startedAt: number;
}

type Action =
  | { type: 'START'; input: BlueprintInput; inputHash: string; useWebSearch: boolean }
  | { type: 'HYDRATE'; persisted: OrchestratorState }
  | { type: 'RESET' }
  | { type: 'STAGE_PENDING'; stage: StageKey }
  | { type: 'STAGE_OK_RESEARCH'; researchPack: string | null }
  | { type: 'STAGE_OK_BIBLE'; bible: StoryBible }
  | {
      type: 'STAGE_OK_OUTLINE';
      outline: BlueprintOutline;
      cipherPlan: Record<number, BlueprintCipherAssignment>;
    }
  | { type: 'STAGE_OK_TRANSITIONS'; transitions: BlueprintTransition[] }
  | { type: 'STAGE_OK_ENDINGS'; endings: BlueprintEnding[] }
  | { type: 'STAGE_ERROR'; stage: StageKey; message: string }
  | { type: 'TASK_PENDING'; poiIndex: number }
  | { type: 'TASK_OK'; poiIndex: number; task: BlueprintTask }
  | { type: 'TASK_ERROR'; poiIndex: number; message: string }
  | { type: 'TASKS_OVERALL_OK' }
  | { type: 'RETRY_STAGE'; stage: StageKey }
  | { type: 'RETRY_TASK'; poiIndex: number };

function emptyData(): OrchestratorState['data'] {
  return { tasks: {} };
}

function initialState(
  input: BlueprintInput,
  inputHash: string,
  useWebSearch: boolean,
): OrchestratorState {
  return {
    inputHash,
    input,
    stages: {
      research: useWebSearch ? 'idle' : 'skipped',
      bible: 'idle',
      outline: 'idle',
      tasks: {},
      tasksOverall: 'idle',
      transitions: 'idle',
      endings: 'idle',
    },
    data: { tasks: {} },
    errors: {},
    startedAt: Date.now(),
  };
}

/**
 * Cascade-on-retry: clearing an upstream stage MUST clear every downstream
 * stage (data + status), otherwise a corrected upstream payload silently
 * leaves stale downstream artefacts. Implemented as one helper so every
 * retry path uses the same cascade.
 */
function clearDownstream(
  state: OrchestratorState,
  fromStage: StageKey,
): OrchestratorState {
  const order: StageKey[] = ['research', 'bible', 'outline'];
  const fromIdx = order.indexOf(fromStage);

  const next = { ...state, stages: { ...state.stages }, data: { ...state.data } };

  // research → wipe everything downstream including bible
  // bible    → wipe outline, tasks, transitions, endings
  // outline  → wipe tasks, transitions, endings
  // (transitions / endings have no downstream other than the final compose)

  if (fromIdx >= 0 && fromIdx <= 0) {
    // research retry: bible needs to re-run with the new pack
    next.stages.bible = 'idle';
    delete next.data.bible;
  }
  if (fromIdx >= 0 && fromIdx <= 1) {
    next.stages.outline = 'idle';
    delete next.data.outline;
    delete next.data.cipherPlan;
  }
  if (fromIdx >= 0 && fromIdx <= 2) {
    next.stages.tasks = {};
    next.stages.tasksOverall = 'idle';
    next.stages.transitions = 'idle';
    next.stages.endings = 'idle';
    next.data.tasks = {};
    delete next.data.transitions;
    delete next.data.endings;
  }
  if (fromStage === 'transitions') {
    delete next.data.transitions;
  }
  if (fromStage === 'endings') {
    delete next.data.endings;
  }

  return next;
}

function reducer(
  state: OrchestratorState | null,
  action: Action,
): OrchestratorState | null {
  switch (action.type) {
    case 'START':
      return initialState(action.input, action.inputHash, action.useWebSearch);
    case 'HYDRATE': {
      // Restored snapshot: any stage left in `pending` mid-flight had its
      // network call lost on refresh. Reset those to `idle` so the scheduler
      // re-fires them; restored `ok` slices stay verbatim.
      const next: OrchestratorState = {
        ...action.persisted,
        stages: { ...action.persisted.stages },
        data: { ...action.persisted.data, tasks: { ...action.persisted.data.tasks } },
        errors: { ...action.persisted.errors },
      };
      const downgrade = (s: StageStatus): StageStatus =>
        s === 'pending' ? 'idle' : s;
      next.stages.research = downgrade(next.stages.research);
      next.stages.bible = downgrade(next.stages.bible);
      next.stages.outline = downgrade(next.stages.outline);
      next.stages.transitions = downgrade(next.stages.transitions);
      next.stages.endings = downgrade(next.stages.endings);
      next.stages.tasks = Object.fromEntries(
        Object.entries(next.stages.tasks).map(([k, v]) => [k, downgrade(v)]),
      );
      // tasksOverall recomputed from per-POI on the next scheduler tick.
      next.stages.tasksOverall =
        next.stages.outline === 'ok' &&
        next.data.outline &&
        next.data.outline.pois.every((p) => next.stages.tasks[p.index] === 'ok')
          ? 'ok'
          : next.stages.outline === 'ok'
            ? 'pending'
            : 'idle';
      return next;
    }
    case 'RESET':
      return null;
    case 'STAGE_PENDING':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, [action.stage]: 'pending' },
      };
    case 'STAGE_OK_RESEARCH':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, research: 'ok' },
        data: { ...state.data, researchPack: action.researchPack },
      };
    case 'STAGE_OK_BIBLE':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, bible: 'ok' },
        data: { ...state.data, bible: action.bible },
      };
    case 'STAGE_OK_OUTLINE':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, outline: 'ok' },
        data: {
          ...state.data,
          outline: action.outline,
          cipherPlan: action.cipherPlan,
        },
      };
    case 'STAGE_OK_TRANSITIONS':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, transitions: 'ok' },
        data: { ...state.data, transitions: action.transitions },
      };
    case 'STAGE_OK_ENDINGS':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, endings: 'ok' },
        data: { ...state.data, endings: action.endings },
      };
    case 'STAGE_ERROR':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, [action.stage]: 'error' },
        errors: {
          ...state.errors,
          [action.stage]: { message: action.message },
        },
      };
    case 'TASK_PENDING':
      if (!state) return state;
      return {
        ...state,
        stages: {
          ...state.stages,
          tasks: { ...state.stages.tasks, [action.poiIndex]: 'pending' },
          tasksOverall: 'pending',
        },
      };
    case 'TASK_OK': {
      if (!state) return state;
      const tasks = { ...state.data.tasks, [action.poiIndex]: action.task };
      const taskStatuses = {
        ...state.stages.tasks,
        [action.poiIndex]: 'ok' as StageStatus,
      };
      const allDone =
        state.data.outline?.pois.every((p) => taskStatuses[p.index] === 'ok') ??
        false;
      return {
        ...state,
        stages: {
          ...state.stages,
          tasks: taskStatuses,
          tasksOverall: allDone ? 'ok' : 'pending',
        },
        data: { ...state.data, tasks },
      };
    }
    case 'TASK_ERROR':
      if (!state) return state;
      return {
        ...state,
        stages: {
          ...state.stages,
          tasks: { ...state.stages.tasks, [action.poiIndex]: 'error' },
          tasksOverall: 'error',
        },
        errors: {
          ...state.errors,
          [`task#${action.poiIndex}`]: { message: action.message },
        },
      };
    case 'TASKS_OVERALL_OK':
      if (!state) return state;
      return {
        ...state,
        stages: { ...state.stages, tasksOverall: 'ok' },
      };
    case 'RETRY_STAGE': {
      if (!state) return state;
      // Cascade clears everything downstream (and the stage itself), then
      // resets the requested stage to `idle` so the scheduler re-fires.
      const cleared = clearDownstream(state, action.stage);
      cleared.stages = {
        ...cleared.stages,
        [action.stage]: 'idle',
      };
      // Drop the stage error so the banner stops showing it red.
      const errors = { ...cleared.errors };
      delete errors[action.stage];
      return { ...cleared, errors };
    }
    case 'RETRY_TASK': {
      if (!state) return state;
      const tasks = { ...state.stages.tasks, [action.poiIndex]: 'idle' as StageStatus };
      const errors = { ...state.errors };
      delete errors[`task#${action.poiIndex}`];
      return {
        ...state,
        stages: {
          ...state.stages,
          tasks,
          tasksOverall: 'pending',
          // Retrying one task leaves transitions/endings stale only if they'd
          // already run; clear them defensively so they re-fire after this
          // task lands.
          transitions: 'idle',
          endings: 'idle',
        },
        data: {
          ...state.data,
          transitions: undefined,
          endings: undefined,
        },
        errors,
      };
    }
    default:
      return state;
  }
}

interface OrchestratorOptions {
  /** When false the research stage is marked `skipped` and never fires. */
  useWebSearch: boolean;
}

export interface UseOrchestratorReturn {
  state: OrchestratorState | null;
  partialBlueprint: Partial<GameBlueprint>;
  composedBlueprint: GameBlueprint | null;
  isComplete: boolean;
  start: (input: BlueprintInput) => void;
  retryStage: (stage: StageKey) => void;
  retryTask: (poiIndex: number) => void;
  resume: () => boolean;
  reset: () => void;
  /** Identity of the persisted entry that would resume on this input, if any. */
  pendingResume: PersistedEntry<OrchestratorState> | null;
}

export function useAiBlueprintOrchestrator(
  draftInput: BlueprintInput | null,
  options: OrchestratorOptions,
): UseOrchestratorReturn {
  const [state, dispatch] = useReducer(reducer, null);

  // Stable refs for use inside async callbacks without re-creating mutations.
  const stateRef = useRef(state);
  stateRef.current = state;
  const useWebSearchRef = useRef(options.useWebSearch);
  useWebSearchRef.current = options.useWebSearch;

  // Persist the running state under the input hash; debounced 200 ms.
  useDebouncedPersist(
    state ? state.inputHash : null,
    state ? { city: state.input.city, theme: state.input.theme } : null,
    state,
  );

  /**
   * Snapshot of the persisted entry matching the current draft form input.
   * Surfaced so the page can render a "Wznów / Zacznij od nowa" modal.
   */
  const pendingResume = useMemo(() => {
    if (!draftInput || state) return null;
    const hash = hashBlueprintInput(draftInput);
    return readPersisted<OrchestratorState>(hash);
  }, [draftInput, state]);

  // Per-stage mutations. Each handler dispatches the matching OK/ERROR action
  // so the reducer drives the scheduler. We don't propagate errors via React
  // Query (no toast) — the banner's per-stage error message is the UX.

  // Helper: drop a stage from the in-flight ref so a future `RETRY_STAGE`
  // can re-fire it. Called from `onSettled` of every per-stage mutation.
  const clearInFlight = (key: string) => {
    // Forward-declared via closure; assigned after the ref is defined below.
    inFlightStages.current?.delete(key);
  };

  const researchMut = useMutation<{ researchPack: string | null }, Error, void>({
    mutationFn: () => {
      const s = stateRef.current!;
      return api.post(
        '/api/admin/ai/games/blueprint/research',
        { input: s.input },
        { timeoutMs: STAGE_TIMEOUT_MS },
      );
    },
    onSuccess: (res) => dispatch({ type: 'STAGE_OK_RESEARCH', researchPack: res.researchPack }),
    onError: (err) => dispatch({ type: 'STAGE_ERROR', stage: 'research', message: err.message }),
    onSettled: () => clearInFlight('research'),
  });

  const bibleMut = useMutation<{ bible: StoryBible }, Error, void>({
    mutationFn: () => {
      const s = stateRef.current!;
      return api.post(
        '/api/admin/ai/games/blueprint/story-bible',
        { input: s.input, researchPack: s.data.researchPack ?? null },
        { timeoutMs: STAGE_TIMEOUT_MS },
      );
    },
    onSuccess: (res) => dispatch({ type: 'STAGE_OK_BIBLE', bible: res.bible }),
    onError: (err) => dispatch({ type: 'STAGE_ERROR', stage: 'bible', message: err.message }),
    onSettled: () => clearInFlight('bible'),
  });

  const outlineMut = useMutation<
    { outline: BlueprintOutline; cipherPlan: Record<number, BlueprintCipherAssignment> },
    Error,
    void
  >({
    mutationFn: () => {
      const s = stateRef.current!;
      return api.post(
        '/api/admin/ai/games/blueprint/outline',
        {
          input: s.input,
          bible: s.data.bible,
          researchPack: s.data.researchPack ?? null,
        },
        { timeoutMs: STAGE_TIMEOUT_MS },
      );
    },
    onSuccess: (res) =>
      dispatch({
        type: 'STAGE_OK_OUTLINE',
        outline: res.outline,
        cipherPlan: res.cipherPlan,
      }),
    onError: (err) => dispatch({ type: 'STAGE_ERROR', stage: 'outline', message: err.message }),
    onSettled: () => clearInFlight('outline'),
  });

  const transitionsMut = useMutation<
    { transitions: BlueprintTransition[] },
    Error,
    void
  >({
    mutationFn: () => {
      const s = stateRef.current!;
      const tasks = sortedTasksFromState(s);
      return api.post(
        '/api/admin/ai/games/blueprint/transitions',
        { input: s.input, outline: s.data.outline, tasks },
        { timeoutMs: STAGE_TIMEOUT_MS },
      );
    },
    onSuccess: (res) =>
      dispatch({ type: 'STAGE_OK_TRANSITIONS', transitions: res.transitions }),
    onError: (err) =>
      dispatch({ type: 'STAGE_ERROR', stage: 'transitions', message: err.message }),
    onSettled: () => clearInFlight('transitions'),
  });

  const endingsMut = useMutation<{ endings: BlueprintEnding[] }, Error, void>({
    mutationFn: () => {
      const s = stateRef.current!;
      const tasks = sortedTasksFromState(s);
      return api.post(
        '/api/admin/ai/games/blueprint/endings',
        {
          input: s.input,
          outline: s.data.outline,
          tasks,
          bible: s.data.bible,
        },
        { timeoutMs: STAGE_TIMEOUT_MS },
      );
    },
    onSuccess: (res) => dispatch({ type: 'STAGE_OK_ENDINGS', endings: res.endings }),
    onError: (err) => dispatch({ type: 'STAGE_ERROR', stage: 'endings', message: err.message }),
    onSettled: () => clearInFlight('endings'),
  });

  /**
   * Per-POI mutation. Fired N times by the scheduler with concurrency cap.
   * Tracked outside React Query because we need per-POI status, not a single
   * shared mutation state.
   */
  const inFlightTasks = useRef<Set<number>>(new Set());
  const fireTaskCall = useCallback(
    async (poiIndex: number) => {
      const s = stateRef.current;
      if (!s || !s.data.outline) return;
      if (inFlightTasks.current.has(poiIndex)) return;
      const poi = s.data.outline.pois.find((p) => p.index === poiIndex);
      if (!poi) {
        dispatch({
          type: 'TASK_ERROR',
          poiIndex,
          message: `POI ${poiIndex} not present in outline`,
        });
        return;
      }
      inFlightTasks.current.add(poiIndex);
      dispatch({ type: 'TASK_PENDING', poiIndex });
      try {
        const res = await api.post<{ task: BlueprintTask }>(
          '/api/admin/ai/games/blueprint/tasks/single',
          {
            input: s.input,
            outline: s.data.outline,
            bible: s.data.bible,
            poiIndex,
            cipherAssignment: s.data.cipherPlan?.[poiIndex],
            researchPack: s.data.researchPack ?? null,
          },
          { timeoutMs: STAGE_TIMEOUT_MS },
        );
        dispatch({ type: 'TASK_OK', poiIndex, task: res.task });
      } catch (err) {
        dispatch({
          type: 'TASK_ERROR',
          poiIndex,
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        inFlightTasks.current.delete(poiIndex);
      }
    },
    [],
  );

  /**
   * Track which stages have been kicked off in the current run. Belt-and-
   * braces against React 18 StrictMode (effects fire twice on mount) and
   * any other path that could re-enter the scheduler before the reducer
   * has flushed `STAGE_PENDING`. Cleared on RESET via a separate effect.
   */
  const inFlightStages = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!state) {
      inFlightStages.current.clear();
    }
  }, [state]);

  /**
   * Scheduler. Runs after each state change to decide what to fire next.
   * Strict DAG: research → bible → outline → tasks×N → (transitions ‖ endings).
   *
   * Mutations are gated on (a) dependencies `ok`, (b) own slot `idle`,
   * (c) own slot not already in `inFlightStages`. The slot flips to
   * `pending` synchronously via `STAGE_PENDING` so the next effect run
   * stops at the gate; the ref is the safety net for StrictMode's double
   * effect invocation before the reducer has flushed.
   */
  useEffect(() => {
    if (!state) return;
    const { stages } = state;
    const inFlight = inFlightStages.current;

    const fire = (
      key: 'research' | 'bible' | 'outline' | 'transitions' | 'endings',
      mutate: () => void,
    ) => {
      if (inFlight.has(key)) return;
      inFlight.add(key);
      dispatch({ type: 'STAGE_PENDING', stage: key });
      mutate();
    };

    if (stages.research === 'idle') {
      fire('research', () => researchMut.mutate());
      return;
    }
    if ((stages.research === 'ok' || stages.research === 'skipped') && stages.bible === 'idle') {
      fire('bible', () => bibleMut.mutate());
      return;
    }
    if (stages.bible === 'ok' && stages.outline === 'idle') {
      fire('outline', () => outlineMut.mutate());
      return;
    }
    if (stages.outline === 'ok' && state.data.outline) {
      // Per-POI fan-out with concurrency cap. fireTaskCall dispatches
      // TASK_PENDING synchronously inside itself, so the next effect run
      // won't double-fire the same POI.
      const poiIndices = state.data.outline.pois.map((p) => p.index);
      const idle = poiIndices.filter((i) => (stages.tasks[i] ?? 'idle') === 'idle');
      const inFlightCount = poiIndices.filter(
        (i) => stages.tasks[i] === 'pending',
      ).length;
      const slots = Math.max(0, MAX_PARALLEL_POI_CALLS - inFlightCount);
      for (const i of idle.slice(0, slots)) {
        fireTaskCall(i);
      }
    }
    if (stages.tasksOverall === 'ok') {
      if (stages.transitions === 'idle') {
        fire('transitions', () => transitionsMut.mutate());
      }
      if (stages.endings === 'idle') {
        fire('endings', () => endingsMut.mutate());
      }
    }
    // We deliberately depend only on the stages map — the data slices are
    // read via refs so adding them here would just thrash the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.stages, state?.data.outline?.pois.length]);

  const start = useCallback(
    (input: BlueprintInput) => {
      dispatch({
        type: 'START',
        input,
        inputHash: hashBlueprintInput(input),
        useWebSearch: useWebSearchRef.current,
      });
    },
    [],
  );
  const retryStage = useCallback(
    (stage: StageKey) => dispatch({ type: 'RETRY_STAGE', stage }),
    [],
  );
  const retryTask = useCallback(
    (poiIndex: number) => dispatch({ type: 'RETRY_TASK', poiIndex }),
    [],
  );
  const resume = useCallback(() => {
    if (!pendingResume) return false;
    dispatch({ type: 'HYDRATE', persisted: pendingResume.state });
    return true;
  }, [pendingResume]);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const partialBlueprint = useMemo<Partial<GameBlueprint>>(() => {
    if (!state) return {};
    const data: OrchestratorData = {
      input: state.input,
      bible: state.data.bible,
      outline: state.data.outline,
      tasks: state.data.tasks,
      transitions: state.data.transitions,
      endings: state.data.endings,
    };
    return composePartialBlueprint(data);
  }, [state]);

  const composedBlueprint = useMemo<GameBlueprint | null>(() => {
    if (!state) return null;
    const data: OrchestratorData = {
      input: state.input,
      bible: state.data.bible,
      outline: state.data.outline,
      tasks: state.data.tasks,
      transitions: state.data.transitions,
      endings: state.data.endings,
    };
    return composeBlueprint(data);
  }, [state]);

  const isComplete = composedBlueprint !== null;

  return {
    state,
    partialBlueprint,
    composedBlueprint,
    isComplete,
    start,
    retryStage,
    retryTask,
    resume,
    reset,
    pendingResume,
  };
}

function sortedTasksFromState(state: OrchestratorState): BlueprintTask[] {
  return Object.values(state.data.tasks).sort((a, b) => a.index - b.index);
}
