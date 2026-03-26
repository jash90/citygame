import { create } from 'zustand';
import type { Game, GameSession, Task, GameProgress } from '@/services/api';

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
  lastScannedQR: string | null;
  lastAiResult: AiResult | null;
  // Actions
  setGame: (game: Game | null) => void;
  setSession: (session: GameSession | null) => void;
  setTasks: (tasks: Task[]) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  updateProgress: (progress: GameProgress) => void;
  markTaskCompleted: (taskId: string) => void;
  setLastScannedQR: (code: string | null) => void;
  setLastAiResult: (result: AiResult) => void;
  clearLastAiResult: () => void;
  reset: () => void;
}

const initialState = {
  currentGame: null,
  currentSession: null,
  tasks: [],
  progress: null,
  completedTaskIds: new Set<string>(),
  lastScannedQR: null,
  lastAiResult: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setGame: (game) => set({ currentGame: game }),

  setSession: (session) => set({ currentSession: session }),

  setTasks: (tasks) => set({ tasks }),

  updateTaskStatus: (taskId, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status } : t,
      ),
    })),

  updateProgress: (progress) => set({ progress }),

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

  setLastScannedQR: (code) => set({ lastScannedQR: code }),

  setLastAiResult: (result) => set({ lastAiResult: result }),

  clearLastAiResult: () => set({ lastAiResult: null }),

  reset: () =>
    set({
      ...initialState,
      completedTaskIds: new Set<string>(),
    }),
}));
