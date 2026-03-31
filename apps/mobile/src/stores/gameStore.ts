import { create } from 'zustand';
import type { Game, GameSession, Task, GameProgress } from '@/services/api';

/** Extract completed task IDs from progress attempts. */
function extractCompletedIds(progress: GameProgress | null): Set<string> {
  if (!progress?.session?.attempts) return new Set<string>();
  return new Set(progress.session.attempts.map((a) => a.taskId));
}

/** Mark tasks as completed based on a set of completed IDs. */
function applyCompletionStatus(tasks: Task[], completedIds: Set<string>): Task[] {
  if (completedIds.size === 0) return tasks;
  return tasks.map((t) =>
    completedIds.has(t.id) ? { ...t, status: 'completed' as const } : t,
  );
}

export interface RevealedHint {
  content: string;
  pointPenalty: number;
}

/** Extract revealed hints per task from progress hintUsages. */
function extractRevealedHints(progress: GameProgress | null): Map<string, RevealedHint[]> {
  const map = new Map<string, RevealedHint[]>();
  if (!progress?.session?.hintUsages) return map;
  for (const hu of progress.session.hintUsages) {
    const taskId = hu.hint.taskId;
    const existing = map.get(taskId) ?? [];
    existing.push({ content: hu.hint.content, pointPenalty: hu.hint.pointPenalty });
    map.set(taskId, existing);
  }
  return map;
}

export interface AiResult {
  attemptId: string;
  status: string;
  score?: number;
  feedback?: string;
}

interface GameState {
  currentGame: Game | null;
  currentSession: GameSession | null;
  tasks: Task[];
  progress: GameProgress | null;
  completedTaskIds: Set<string>;
  collectedClues: string[];
  revealedHints: Map<string, RevealedHint[]>;
  lastScannedQR: string | null;
  lastAiResult: AiResult | null;
  gameEnded: boolean;
  // Actions
  setGame: (game: Game | null) => void;
  setSession: (session: GameSession | null) => void;
  setTasks: (tasks: Task[]) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  updateProgress: (progress: GameProgress) => void;
  markTaskCompleted: (taskId: string) => void;
  addClue: (clue: string) => void;
  setLastScannedQR: (code: string | null) => void;
  setLastAiResult: (result: AiResult) => void;
  clearLastAiResult: () => void;
  setGameEnded: (ended: boolean) => void;
  addRevealedHint: (taskId: string, hint: RevealedHint) => void;
  getTaskHints: (taskId: string) => RevealedHint[];
  restoreSession: (game: Game, session: GameSession, tasks: Task[], progress?: GameProgress | null) => void;
  reset: () => void;
}

const initialState = {
  currentGame: null,
  currentSession: null,
  tasks: [],
  progress: null,
  completedTaskIds: new Set<string>(),
  collectedClues: [],
  revealedHints: new Map<string, RevealedHint[]>(),
  lastScannedQR: null,
  lastAiResult: null,
  gameEnded: false,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setGame: (game) => set({ currentGame: game }),

  setSession: (session) => set({ currentSession: session }),

  setTasks: (tasks) =>
    set((state) => ({
      tasks: applyCompletionStatus(tasks, state.completedTaskIds),
    })),

  updateTaskStatus: (taskId, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status } : t,
      ),
    })),

  updateProgress: (progress) =>
    set((state) => {
      const completedIds = extractCompletedIds(progress);
      return {
        progress,
        completedTaskIds: completedIds,
        tasks: applyCompletionStatus(state.tasks, completedIds),
        revealedHints: extractRevealedHints(progress),
      };
    }),

  markTaskCompleted: (taskId) =>
    set((state) => {
      const completedTaskIds = new Set(state.completedTaskIds);
      completedTaskIds.add(taskId);
      return {
        completedTaskIds,
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'completed' as const } : t,
        ),
      };
    }),

  addClue: (clue) =>
    set((state) => ({ collectedClues: [...state.collectedClues, clue] })),

  setLastScannedQR: (code) => set({ lastScannedQR: code }),

  setLastAiResult: (result) => set({ lastAiResult: result }),

  clearLastAiResult: () => set({ lastAiResult: null }),

  setGameEnded: (ended) => set({ gameEnded: ended }),

  addRevealedHint: (taskId, hint) =>
    set((state) => {
      const hints = new Map(state.revealedHints);
      const existing = hints.get(taskId) ?? [];
      hints.set(taskId, [...existing, hint]);
      return { revealedHints: hints };
    }),

  getTaskHints: (taskId) => {
    return useGameStore.getState().revealedHints.get(taskId) ?? [];
  },

  restoreSession: (game, session, tasks, progress) => {
    const completedIds = extractCompletedIds(progress ?? null);
    set({
      currentGame: game,
      currentSession: session,
      tasks: applyCompletionStatus(tasks, completedIds),
      progress: progress ?? null,
      gameEnded: false,
      completedTaskIds: completedIds,
      revealedHints: extractRevealedHints(progress ?? null),
      collectedClues: [],
    });
  },

  reset: () =>
    set({
      ...initialState,
      completedTaskIds: new Set<string>(),
      collectedClues: [],
      revealedHints: new Map<string, RevealedHint[]>(),
    }),
}));
