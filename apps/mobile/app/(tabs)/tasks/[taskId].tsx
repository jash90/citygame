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
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/lib/unistyles';
import { TaskTypeBadge } from '@/components/ui/Badge';
import { TaskRenderer } from '@/components/task/TaskRenderer';
import { AIVerificationStatus } from '@/components/task/AIVerificationStatus';
import { useSubmitTask, useUnlockTask, useHint } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import type { TaskSubmission, HintResult } from '@/services/api';

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
    if (remaining <= 0) {
      onExpireRef.current();
      return;
    }
    const timer = setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 30;

  return (
    <View style={styles.timerContainer(isUrgent)}>
      <Ionicons name="timer-outline" size={16} color={isUrgent ? '#DC2626' : '#B45309'} />
      <Text style={styles.timerText(isUrgent)}>
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
    <View style={styles.hintsGap}>
      {revealedHints.map((hint, index) => (
        <View key={index} style={styles.hintCard}>
          <Text style={styles.hintLabel}>
            Podpowiedź {index + 1}
            {hint.pointPenalty > 0 ? ` (-${hint.pointPenalty} pkt)` : ''}
          </Text>
          <Text style={styles.hintContent}>{hint.content}</Text>
        </View>
      ))}
      <TouchableOpacity
        style={styles.hintButton(hintMutation.isPending)}
        onPress={handleRevealHint}
        disabled={hintMutation.isPending}
        activeOpacity={0.8}
      >
        {hintMutation.isPending ? (
          <ActivityIndicator size="small" color="#FF6B35" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="bulb-outline" size={16} color="#6B7280" />
            <Text style={styles.hintButtonText}>
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
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>
          Nie znaleziono zadania
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Wróć</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Task meta */}
        <View style={styles.metaRow}>
          <TaskTypeBadge type={task.type} />
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeText}>
              {task.points} pkt
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.descriptionText}>
            {task.description}
          </Text>
        </View>

        {/* Locked state — show unlock button */}
        {isLocked ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed" size={30} color="#9CA3AF" />
            <Text style={styles.lockedText}>
              To zadanie jest jeszcze zablokowane. Odblokuj je, aby zobaczyć treść.
            </Text>
            <TouchableOpacity
              style={styles.unlockButton(unlockMutation.isPending)}
              onPress={handleUnlock}
              disabled={unlockMutation.isPending}
              activeOpacity={0.8}
            >
              {unlockMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.unlockButtonText}>Odblokuj zadanie</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Task input */}
            <View style={styles.card}>
              <Text style={styles.answerLabel}>
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
                  style={styles.hintsToggle}
                  onPress={() => setShowHints((prev) => !prev)}
                >
                  <Ionicons name="bulb-outline" size={16} color="#FF6B35" />
                  <Text style={styles.hintsToggleText}>
                    Podpowiedzi
                  </Text>
                  <Ionicons name={showHints ? 'chevron-up' : 'chevron-down'} size={16} color="#FF6B35" />
                </TouchableOpacity>
                {showHints ? (
                  <HintsPanel gameId={gameId} taskId={task.id} />
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
  },
  backLink: {
    marginTop: 16,
  },
  backLinkText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  backButton: {
    marginRight: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: theme.colors.gray[700],
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.secondary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsBadge: {
    backgroundColor: withAlpha(theme.colors.primary, 0.1),
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pointsBadgeText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.gray[100],
  },
  descriptionText: {
    fontSize: 16,
    color: theme.colors.gray[700],
    lineHeight: 16 * 1.75,
  },
  lockedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.gray[100],
    alignItems: 'center',
    gap: 12,
  },
  lockedEmoji: {
    fontSize: 30,
  },
  lockedText: {
    fontSize: 14,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  unlockButton: (isPending: boolean) => ({
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    opacity: isPending ? 0.5 : 1,
  }),
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: theme.fontWeight.bold,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: 12,
  },
  hintsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  hintsToggleText: {
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  hintsToggleArrow: {
    color: theme.colors.primary,
  },
  hintsGap: {
    gap: 8,
  },
  hintCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    backgroundColor: theme.colors.amber[50],
    borderColor: theme.colors.amber[200],
  },
  hintLabel: {
    fontSize: 12,
    color: theme.colors.amber[600],
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },
  hintContent: {
    fontSize: 14,
    color: theme.colors.amber[800],
  },
  hintButton: (isPending: boolean) => ({
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    backgroundColor: theme.colors.gray[50],
    alignItems: 'center' as const,
    opacity: isPending ? 0.5 : 1,
  }),
  hintButtonText: {
    fontSize: 14,
    color: theme.colors.gray[500],
    textAlign: 'center' as const,
  },
  timerContainer: (isUrgent: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: isUrgent ? theme.colors.red[100] : theme.colors.amber[100],
  }),
  timerIcon: {
    fontSize: 16,
  },
  timerText: (isUrgent: boolean) => ({
    fontSize: 14,
    fontWeight: theme.fontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    color: isUrgent ? theme.colors.red[600] : theme.colors.amber[700],
  }),
}));
