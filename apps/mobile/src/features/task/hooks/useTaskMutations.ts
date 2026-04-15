import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gamesApi } from '@/features/game/services/games.api';
import { useGameStore } from '@/features/game/stores/gameStore';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { TaskSubmission } from '@citygame/shared';

export const useSubmitTask = () => {
  const { markTaskCompleted } = useGameStore();
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

export const useDevComplete = () => {
  const { markTaskCompleted } = useGameStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ gameId, taskId }: { gameId: string; taskId: string }) =>
      gamesApi.devComplete(gameId, taskId),
    onSuccess: (attempt, variables) => {
      markTaskCompleted(variables.taskId);
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
      unlockData,
    }: {
      gameId: string;
      taskId: string;
      unlockData?: Record<string, unknown>;
    }) => gamesApi.unlockTask(gameId, taskId, unlockData),
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
