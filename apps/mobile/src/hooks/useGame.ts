import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamesApi } from '@/services/api';
import { useGameStore } from '@/stores/gameStore';
import { QUERY_KEYS } from '@/lib/constants';
import type { TaskSubmission } from '@/services/api';

export const useGames = () => {
  return useQuery({
    queryKey: QUERY_KEYS.GAMES,
    queryFn: () => gamesApi.list(),
  });
};

export const useGame = (gameId: string) => {
  const { setGame, setTasks } = useGameStore();

  return useQuery({
    queryKey: QUERY_KEYS.GAME(gameId),
    queryFn: async () => {
      const game = await gamesApi.get(gameId);
      setGame(game);
      if (game.tasks) {
        setTasks(game.tasks);
      }
      return game;
    },
    enabled: Boolean(gameId),
  });
};

export const useStartGame = () => {
  const { setSession } = useGameStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gameId: string) => gamesApi.start(gameId),
    onSuccess: (session) => {
      setSession(session);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GAMES });
    },
  });
};

export const useProgress = (gameId: string) => {
  const { updateProgress } = useGameStore();

  return useQuery({
    queryKey: ['progress', gameId] as const,
    queryFn: async () => {
      const data = await gamesApi.progress(gameId);
      updateProgress(data);
      return data;
    },
    enabled: Boolean(gameId),
    refetchInterval: 30_000,
  });
};

export const useSubmitTask = () => {
  const { markTaskCompleted, updateTaskStatus } = useGameStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      gameId,
      taskId,
      submission,
    }: {
      gameId: string;
      taskId: string;
      submission: TaskSubmission;
    }) => gamesApi.submitTask(gameId, taskId, submission),
    onSuccess: (attempt, variables) => {
      if (attempt.status === 'CORRECT' || attempt.status === 'PARTIAL') {
        markTaskCompleted(variables.taskId);
      } else {
        updateTaskStatus(variables.taskId, 'failed');
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

export const useUnlockTask = () => {
  const { updateTaskStatus } = useGameStore();

  return useMutation({
    mutationFn: ({
      gameId,
      taskId,
    }: {
      gameId: string;
      taskId: string;
    }) => gamesApi.unlockTask(gameId, taskId),
    onSuccess: (result, variables) => {
      if (result.unlocked) {
        updateTaskStatus(variables.taskId, 'available');
      }
    },
  });
};

export const useHint = () => {
  return useMutation({
    mutationFn: ({
      gameId,
      taskId,
    }: {
      gameId: string;
      taskId: string;
    }) => gamesApi.useHint(gameId, taskId),
  });
};

export const useRanking = (gameId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.RANKING(gameId),
    queryFn: () => gamesApi.ranking(gameId),
    enabled: Boolean(gameId),
  });
};

// Keep useTasks for backward compat — tasks are now embedded in the game response
export const useTasks = (gameId: string) => {
  const { setTasks } = useGameStore();

  return useQuery({
    queryKey: QUERY_KEYS.TASKS(gameId),
    queryFn: async () => {
      const game = await gamesApi.get(gameId);
      const tasks = game.tasks ?? [];
      setTasks(tasks);
      return tasks;
    },
    enabled: Boolean(gameId),
  });
};
