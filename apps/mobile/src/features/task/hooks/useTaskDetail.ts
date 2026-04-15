import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/features/game/stores/gameStore';
import { useLocationStore } from '@/features/map/stores/locationStore';
import { useSubmitTask, useUnlockTask, useDevComplete } from '@/features/task/hooks/useTaskMutations';
import type { Task } from '@/shared/types/api.types';
import type { TaskSubmission } from '@citygame/shared';

interface UseTaskDetailOptions {
  taskId: string;
  from?: string;
}

interface UseTaskDetailReturn {
  task: Task | undefined;
  gameId: string;
  isLocked: boolean;
  storyContext: Record<string, string> | null;
  goBack: () => void;
  handleUnlock: () => void;
  handleSubmit: (submission: TaskSubmission) => Promise<void>;
  handleTimerExpire: () => void;
  submitMutation: ReturnType<typeof useSubmitTask>;
  unlockMutation: ReturnType<typeof useUnlockTask>;
  devCompleteMutation: ReturnType<typeof useDevComplete>;
}

export function useTaskDetail({
  taskId,
  from,
}: UseTaskDetailOptions): UseTaskDetailReturn {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const goBack = (): void => {
    if (from === 'map') {
      router.navigate('/(tabs)/map' as never);
    } else {
      router.navigate('/(tabs)/tasks' as never);
    }
  };

  const {
    tasks,
    currentGame,
    currentSession,
    lastAiResult,
    clearLastAiResult,
    addClue,
  } = useGameStore();
  const submitMutation = useSubmitTask();
  const unlockMutation = useUnlockTask();
  const devCompleteMutation = useDevComplete();

  const task = tasks.find((t) => t.id === taskId);
  const gameId = currentGame?.id ?? '';

  // Parse story context if present
  const storyContext = task?.storyContext
    ? (() => {
        try {
          return JSON.parse(task.storyContext!) as Record<string, string>;
        } catch {
          return null;
        }
      })()
    : null;

  const isLocked = task?.status === 'locked';

  // Track whether handleSubmit already navigated to prevent double modal from WebSocket
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    hasNavigatedRef.current = false;
  }, [taskId]);

  // When a WebSocket ai:result arrives for this task, auto-navigate to result modal
  useEffect(() => {
    if (!lastAiResult || !task || hasNavigatedRef.current) return;

    const isComplete =
      lastAiResult.status === 'CORRECT' ||
      lastAiResult.status === 'INCORRECT' ||
      lastAiResult.status === 'PARTIAL';

    if (!isComplete) return;

    const isSuccess =
      lastAiResult.status === 'CORRECT' || lastAiResult.status === 'PARTIAL';

    clearLastAiResult();

    routerRef.current.push({
      pathname: '/(modals)/task-result' as never,
      params: {
        success: isSuccess ? '1' : '0',
        points: String(0),
        feedback: lastAiResult.feedback ?? '',
        aiScore: String(lastAiResult.score ?? ''),
        isAiTask: '1',
      },
    });
  }, [lastAiResult, task, clearLastAiResult]);

  const handleUnlock = (): void => {
    if (!task || !gameId) return;

    let unlockData: Record<string, unknown> | undefined;
    if (task.unlockMethod === 'GPS') {
      const playerLocation = useLocationStore.getState().location;
      if (!playerLocation) {
        Alert.alert('Brak lokalizacji', 'Włącz GPS i spróbuj ponownie.');
        return;
      }
      unlockData = {
        latitude: playerLocation.lat,
        longitude: playerLocation.lng,
      };
    }

    unlockMutation.mutate(
      { gameId, taskId: task.id, unlockData },
      {
        onSuccess: (result) => {
          if (!result.unlocked) {
            Alert.alert('Zadanie zablokowane', result.message);
          }
        },
        onError: () => {
          Alert.alert('Błąd', 'Nie udało się odblokować zadania.');
        },
      },
    );
  };

  const handleSubmit = async (submission: TaskSubmission): Promise<void> => {
    if (!task || !gameId) return;
    try {
      const attempt = await submitMutation.mutateAsync({
        gameId,
        taskId: task.id,
        submission,
      });

      const isSuccess =
        attempt.status === 'CORRECT' || attempt.status === 'PARTIAL';

      // Collect clue from story context on success
      if (isSuccess && storyContext?.clueRevealed) {
        addClue(storyContext.clueRevealed);
      }

      // Check if all tasks are now completed
      const { completedTaskIds: currentCompleted, tasks: allTasks } =
        useGameStore.getState();
      const completedAfter = new Set(currentCompleted);
      if (isSuccess) completedAfter.add(task.id);
      const allDone =
        allTasks.length > 0 && allTasks.every((t) => completedAfter.has(t.id));

      hasNavigatedRef.current = true;

      if (allDone) {
        router.replace({
          pathname: '/game-summary' as never,
          params: {
            totalPoints: String(
              attempt.pointsAwarded + (currentSession?.totalPoints ?? 0),
            ),
            tasksCompleted: String(completedAfter.size),
            totalTasks: String(allTasks.length),
            timeTakenSec: '0',
            rank: '0',
          },
        });
        return;
      }

      router.push({
        pathname: '/(modals)/task-result' as never,
        params: {
          success: isSuccess ? '1' : '0',
          points: String(attempt.pointsAwarded),
          feedback:
            attempt.status === 'CORRECT'
              ? 'Świetna robota!'
              : attempt.status === 'PARTIAL'
                ? 'Częściowo poprawna odpowiedź.'
                : 'Niestety, to nie ta odpowiedź.',
          clue:
            isSuccess && storyContext?.clueRevealed
              ? storyContext.clueRevealed
              : '',
        },
      });
    } catch {
      Alert.alert(
        'Błąd',
        'Nie udało się wysłać odpowiedzi. Spróbuj ponownie.',
      );
    }
  };

  const handleTimerExpire = (): void => {
    Alert.alert('Czas minął!', 'Niestety czas na to zadanie dobiegł końca.', [
      { text: 'OK', onPress: () => goBack() },
    ]);
  };

  return {
    task,
    gameId,
    isLocked,
    storyContext,
    goBack,
    handleUnlock,
    handleSubmit,
    handleTimerExpire,
    submitMutation,
    unlockMutation,
    devCompleteMutation,
  };
}
