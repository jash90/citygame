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
import { useSubmitTask, useUnlockTask, useHint } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import type { TaskSubmission, HintResult } from '@/services/api';
import { colors } from '@/lib/theme';

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

// ── Hints panel — uses real hint API ─────────────────────────────────────────

const HintsPanel = ({
  gameId,
  taskId,
}: {
  gameId: string;
  taskId: string;
}): React.JSX.Element => {
  const hintMutation = useHint();
  const [revealedHints, setRevealedHints] = useState<HintResult['hint'][]>([]);

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
                  setRevealedHints((prev) => [...prev, result.hint]);
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
      <TouchableOpacity
        className={`rounded-xl p-3 border border-gray-200 bg-gray-50 items-center ${hintMutation.isPending ? 'opacity-50' : 'opacity-100'}`}
        onPress={handleRevealHint}
        disabled={hintMutation.isPending}
        activeOpacity={0.8}
      >
        {hintMutation.isPending ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="bulb-outline" size={16} color="#6B7280" />
            <Text className="text-sm text-gray-500 text-center">
              Poproś o kolejną podpowiedź
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TaskDetailScreen(): React.JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [showHints, setShowHints] = useState(false);

  const { tasks, currentGame, currentSession, lastAiResult, clearLastAiResult } = useGameStore();
  const submitMutation = useSubmitTask();
  const unlockMutation = useUnlockTask();

  const task = tasks.find((t) => t.id === taskId);
  const gameId = currentGame?.id ?? '';

  // Task needs to be unlocked before showing the input form
  const isLocked = task?.status === 'locked';

  const isAiTask =
    task?.type === 'PHOTO_AI' || task?.type === 'AUDIO_AI' || task?.type === 'TEXT_AI';

  // When a WebSocket ai:result arrives for this task, auto-navigate to result modal
  useEffect(() => {
    if (!lastAiResult || !task) return;

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
        points: String(0), // actual points come from the attempt; AI result may not carry them
        feedback: lastAiResult.feedback ?? '',
        aiScore: String(lastAiResult.score ?? ''),
        isAiTask: '1',
      },
    });
  }, [lastAiResult, task, clearLastAiResult]);

  const handleUnlock = (): void => {
    if (!task || !gameId) return;
    unlockMutation.mutate(
      { gameId, taskId: task.id },
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
        },
      });
    } catch {
      Alert.alert('Błąd', 'Nie udało się wysłać odpowiedzi. Spróbuj ponownie.');
    }
  };

  const handleTimerExpire = (): void => {
    Alert.alert('Czas minął!', 'Niestety czas na to zadanie dobiegł końca.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (!task) {
    // Tasks not yet loaded — show spinner
    if (tasks.length === 0) {
      return (
        <StyledSafeAreaView className="flex-1 bg-surface items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </StyledSafeAreaView>
      );
    }
    return (
      <StyledSafeAreaView className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-lg font-semibold text-gray-900 text-center">
          Nie znaleziono zadania
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
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
          onPress={() => router.back()}
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
              <Text className="text-sm font-semibold text-gray-900 mb-3">
                Twoja odpowiedź
              </Text>
              <TaskRenderer
                task={task}
                onSubmit={handleSubmit}
                isSubmitting={submitMutation.isPending}
              />
            </View>

            {/* AI verification status (shown when submission is pending AI check) */}
            {isAiTask && submitMutation.isPending ? (
              <AIVerificationStatus status="processing" />
            ) : null}

            {/* Hints */}
            {currentSession && (
              <View>
                <TouchableOpacity
                  className="flex-row items-center gap-2 py-2"
                  onPress={() => setShowHints((prev) => !prev)}
                >
                  <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                  <Text className="text-sm font-semibold text-primary">
                    Podpowiedzi
                  </Text>
                  <Ionicons name={showHints ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
                </TouchableOpacity>
                {showHints ? (
                  <HintsPanel gameId={gameId} taskId={task.id} />
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </StyledSafeAreaView>
  );
}
