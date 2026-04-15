import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyledSafeAreaView } from '@/shared/lib/styled';
import { TaskTypeBadge } from '@/shared/components/ui/Badge';
import { TaskRenderer } from '@/features/task/components/TaskRenderer';
import { StoryContextCard } from '@/features/task/components/StoryContextCard';
import { CountdownTimer } from '@/features/task/components/CountdownTimer';
import { HintsPanel } from '@/features/task/components/HintsPanel';
import { useTaskDetail } from '@/features/task/hooks/useTaskDetail';
import { useGameStore } from '@/features/game/stores/gameStore';

export default function TaskDetailScreen(): React.JSX.Element {
  const { taskId, from } = useLocalSearchParams<{
    taskId: string;
    from?: string;
  }>();
  const router = useRouter();

  const {
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
  } = useTaskDetail({ taskId, from });

  const [showHints, setShowHints] = useState(false);
  const currentSession = useGameStore((s) => s.currentSession);

  if (!task) {
    const tasks = useGameStore((s) => s.tasks);
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
        <Text
          className="flex-1 text-base font-bold text-secondary"
          numberOfLines={1}
        >
          {task.title}
        </Text>
        {task.timeLimitSec && !isLocked ? (
          <CountdownTimer
            seconds={task.timeLimitSec}
            onExpire={handleTimerExpire}
          />
        ) : null}
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={120}
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
        {storyContext ? <StoryContextCard context={storyContext} /> : null}

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
              To zadanie jest jeszcze zablokowane. Odblokuj je, aby zobaczyć
              treść.
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
                  <Ionicons
                    name={showHints ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#FF6B35"
                  />
                </TouchableOpacity>
                {showHints ? (
                  <HintsPanel
                    gameId={gameId}
                    taskId={task.id}
                    totalHints={task.hintCount}
                  />
                ) : null}
              </View>
            )}
          </>
        )}

        {/* DEV button */}
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
                    const { completedTaskIds: currentCompleted, tasks: allTasks } =
                      useGameStore.getState();
                    const completedAfter = new Set(currentCompleted);
                    completedAfter.add(task.id);
                    const allDone =
                      allTasks.length > 0 &&
                      allTasks.every((t) => completedAfter.has(t.id));

                    if (allDone) {
                      router.replace({
                        pathname: '/game-summary' as never,
                        params: {
                          totalPoints: String(
                            attempt.pointsAwarded +
                              (currentSession?.totalPoints ?? 0),
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
                        success: '1',
                        points: String(attempt.pointsAwarded),
                        feedback: 'DEV auto-complete',
                      },
                    });
                  },
                  onError: (error: Error) => {
                    Alert.alert(
                      'DEV auto-complete failed',
                      error.message || 'Unknown error',
                    );
                  },
                },
              );
            }}
            disabled={devCompleteMutation.isPending}
            activeOpacity={0.7}
          >
            <Text className="text-sm font-bold text-red-500">
              DEV: Auto-complete
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAwareScrollView>
    </StyledSafeAreaView>
  );
}
