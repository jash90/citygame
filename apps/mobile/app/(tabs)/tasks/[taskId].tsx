import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyledSafeAreaView } from '@/lib/styled';
import { TaskTypeBadge } from '@/components/ui/Badge';
import { TaskRenderer } from '@/components/task/TaskRenderer';
import { AIVerificationStatus } from '@/components/task/AIVerificationStatus';
import { StoryContextCard } from '@/components/task/StoryContextCard';
import { useSubmitTask, useUnlockTask, useHint, useDevComplete } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import { useLocationStore } from '@/stores/locationStore';
import type { TaskSubmission } from '@/services/api';

// ── Countdown timer ───────────────────────────────────────────────────────────

const CountdownTimer = ({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}): React.JSX.Element => {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 30;

  return (
    <View className={`flex-row items-center gap-1.5 rounded-xl px-3 py-1.5 ${isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}>
      <Ionicons name="timer-outline" size={16} color={isUrgent ? '#DC2626' : '#B45309'} />
      <Text className={`text-sm font-bold tabular-nums ${isUrgent ? 'text-red-600' : 'text-amber-700'}`}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
};

// ── Hints panel — uses real hint API + store for persistence ─────────────────

const EMPTY_HINTS: { content: string; pointPenalty: number }[] = [];

const HintsPanel = ({
  gameId,
  taskId,
  totalHints,
}: {
  gameId: string;
  taskId: string;
  totalHints: number;
}): React.JSX.Element => {
  const hintMutation = useHint();
  const revealedHints = useGameStore((s) => s.revealedHints.get(taskId) ?? EMPTY_HINTS);
  const addRevealedHint = useGameStore((s) => s.addRevealedHint);

  const allUsed = revealedHints.length >= totalHints;

  const handleRevealHint = (): void => {
    Alert.alert(
      'Użyj podpowiedzi?',
      'Skorzystanie z podpowiedzi spowoduje odjęcie punktów.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Użyj podpowiedzi',
          onPress: () => {
            hintMutation.mutate(
              { gameId, taskId },
              {
                onSuccess: (result) => {
                  addRevealedHint(taskId, {
                    content: result.hint.content,
                    pointPenalty: result.hint.pointPenalty,
                  });
                },
                onError: () => {
                  Alert.alert('Błąd', 'Nie udało się pobrać podpowiedzi.');
                },
              },
            );
          },
        },
      ],
    );
  };

  return (
    <View className="gap-2">
      {revealedHints.map((hint, index) => (
        <View key={index} className="rounded-xl p-3 border border-amber-200 bg-amber-50">
          <Text className="text-xs text-amber-600 font-semibold mb-1">
            Podpowiedź {index + 1}
            {hint.pointPenalty > 0 ? ` (-${hint.pointPenalty} pkt)` : ''}
          </Text>
          <Text className="text-sm text-amber-800">{hint.content}</Text>
        </View>
      ))}
      {!allUsed && (
        <TouchableOpacity
          className={`rounded-xl p-3 border border-gray-200 bg-gray-50 items-center ${hintMutation.isPending ? 'opacity-50' : 'opacity-100'}`}
          onPress={handleRevealHint}
          disabled={hintMutation.isPending}
          activeOpacity={0.8}
        >
          {hintMutation.isPending ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="bulb-outline" size={16} color="#6B7280" />
              <Text className="text-sm text-gray-500 text-center">
                Poproś o podpowiedź ({revealedHints.length}/{totalHints})
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
      {allUsed && revealedHints.length > 0 && (
        <Text className="text-xs text-gray-400 text-center py-1">
          Wykorzystano wszystkie podpowiedzi
        </Text>
      )}
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TaskDetailScreen(): React.JSX.Element {
  const { taskId, from } = useLocalSearchParams<{ taskId: string; from?: string }>();
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
  const [showHints, setShowHints] = useState(false);

  const { tasks, currentGame, currentSession, lastAiResult, clearLastAiResult, addClue } = useGameStore();
  const submitMutation = useSubmitTask();
  const unlockMutation = useUnlockTask();
  const devCompleteMutation = useDevComplete();

  const task = tasks.find((t) => t.id === taskId);
  const gameId = currentGame?.id ?? '';

  // Parse story context if present
  const storyContext = task?.storyContext ? (() => {
    try { return JSON.parse(task.storyContext!) as Record<string, string>; }
    catch { return null; }
  })() : null;

  // Task needs to be unlocked before showing the input form
  const isLocked = task?.status === 'locked';

  const isAiTask =
    task?.type === 'PHOTO_AI' || task?.type === 'AUDIO_AI' || task?.type === 'TEXT_AI';

  // Track whether handleSubmit already navigated to prevent double modal from WebSocket
  const hasNavigatedRef = useRef(false);
  useEffect(() => { hasNavigatedRef.current = false; }, [taskId]);

  // When a WebSocket ai:result arrives for this task, auto-navigate to result modal
  // Only fires if handleSubmit hasn't already shown the result (e.g. PENDING → async AI)
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
      unlockData = { latitude: playerLocation.lat, longitude: playerLocation.lng };
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
      const { completedTaskIds: currentCompleted, tasks: allTasks } = useGameStore.getState();
      const completedAfter = new Set(currentCompleted);
      if (isSuccess) completedAfter.add(task.id);
      const allDone = allTasks.length > 0 && allTasks.every((t) => completedAfter.has(t.id));

      hasNavigatedRef.current = true;

      if (allDone) {
        router.replace({
          pathname: '/game-summary' as never,
          params: {
            totalPoints: String(attempt.pointsAwarded + (currentSession?.totalPoints ?? 0)),
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
          clue: isSuccess && storyContext?.clueRevealed ? storyContext.clueRevealed : '',
        },
      });
    } catch {
      Alert.alert('Błąd', 'Nie udało się wysłać odpowiedzi. Spróbuj ponownie.');
    }
  };

  const handleTimerExpire = (): void => {
    Alert.alert('Czas minął!', 'Niestety czas na to zadanie dobiegł końca.', [
      { text: 'OK', onPress: () => goBack() },
    ]);
  };

  if (!task) {
    // Tasks not yet loaded — show spinner
    if (tasks.length === 0) {
      return (
        <StyledSafeAreaView className="flex-1 bg-surface items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </StyledSafeAreaView>
      );
    }
    return (
      <StyledSafeAreaView className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-lg font-semibold text-gray-900 text-center">
          Nie znaleziono zadania
        </Text>
        <TouchableOpacity onPress={goBack} className="mt-4">
          <Text className="text-primary font-semibold">Wróć</Text>
        </TouchableOpacity>
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-surface border-b border-gray-100">
        <TouchableOpacity
          onPress={goBack}
          className="mr-3 w-8 h-8 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-base font-bold text-secondary" numberOfLines={1}>
          {task.title}
        </Text>
        {task.timeLimitSec && !isLocked ? (
          <CountdownTimer
            seconds={task.timeLimitSec}
            onExpire={handleTimerExpire}
          />
        ) : null}
      </View>

      <ScrollView
        className="px-4 py-4"
        contentContainerStyle={{ gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Task meta */}
        <View className="flex-row items-center gap-2">
          <TaskTypeBadge type={task.type} />
          <View className="bg-primary/10 rounded-full px-2.5 py-0.5">
            <Text className="text-xs font-semibold text-primary">
              {task.points} pkt
            </Text>
          </View>
        </View>

        {/* Story context (narrative games) */}
        {storyContext ? (
          <StoryContextCard context={storyContext} />
        ) : null}

        {/* Description */}
        <View className="bg-surface rounded-2xl p-4 border border-gray-100">
          <Text className="text-base text-gray-700 leading-7">
            {task.description}
          </Text>
        </View>

        {/* Locked state — show unlock button */}
        {isLocked ? (
          <View className="bg-surface rounded-2xl p-4 border border-gray-100 items-center gap-3">
            <Ionicons name="lock-closed" size={30} color="#9CA3AF" />
            <Text className="text-sm text-gray-600 text-center">
              To zadanie jest jeszcze zablokowane. Odblokuj je, aby zobaczyć treść.
            </Text>
            <TouchableOpacity
              className={`bg-primary rounded-xl px-6 py-3 ${unlockMutation.isPending ? 'opacity-50' : 'opacity-100'}`}
              onPress={handleUnlock}
              disabled={unlockMutation.isPending}
              activeOpacity={0.8}
            >
              {unlockMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-bold">Odblokuj zadanie</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Task input */}
            <View className="bg-surface rounded-2xl p-4 border border-gray-100">
              <TaskRenderer
                task={task}
                onSubmit={handleSubmit}
                isSubmitting={submitMutation.isPending}
              />
            </View>

            {__DEV__ && task.status !== 'completed' && (
              <TouchableOpacity
                className="border-2 border-dashed border-red-400 rounded-xl py-3 items-center bg-red-50"
                accessible
                accessibilityRole="button"
                accessibilityLabel="DEV Auto-complete"
                onPress={() => {
                  devCompleteMutation.mutate(
                    { gameId, taskId: task.id },
                    {
                      onSuccess: (attempt) => {
                        hasNavigatedRef.current = true;
                        const { completedTaskIds: currentCompleted, tasks: allTasks } = useGameStore.getState();
                        const completedAfter = new Set(currentCompleted);
                        completedAfter.add(task.id);
                        const allDone = allTasks.length > 0 && allTasks.every((t) => completedAfter.has(t.id));

                        if (allDone) {
                          router.replace({
                            pathname: '/game-summary' as never,
                            params: {
                              totalPoints: String(attempt.pointsAwarded + (currentSession?.totalPoints ?? 0)),
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
                            success: '1',
                            points: String(attempt.pointsAwarded),
                            feedback: 'DEV auto-complete',
                          },
                        });
                      },
                      onError: () => {
                        Alert.alert('Błąd', 'DEV auto-complete failed.');
                      },
                    },
                  );
                }}
                disabled={devCompleteMutation.isPending}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-bold text-red-500">DEV: Auto-complete</Text>
              </TouchableOpacity>
            )}

            {/* AI verification status (shown when submission is pending AI check) */}
            {isAiTask && submitMutation.isPending ? (
              <AIVerificationStatus status="processing" />
            ) : null}

            {/* Hints */}
            {currentSession && task.hintCount > 0 && (
              <View>
                <TouchableOpacity
                  className="flex-row items-center gap-2 py-2"
                  onPress={() => setShowHints((prev) => !prev)}
                >
                  <Ionicons name="bulb-outline" size={16} color="#FF6B35" />
                  <Text className="text-sm font-semibold text-primary">
                    Podpowiedzi
                  </Text>
                  <Ionicons name={showHints ? 'chevron-up' : 'chevron-down'} size={16} color="#FF6B35" />
                </TouchableOpacity>
                {showHints ? (
                  <HintsPanel gameId={gameId} taskId={task.id} totalHints={task.hintCount} />
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </StyledSafeAreaView>
  );
}
