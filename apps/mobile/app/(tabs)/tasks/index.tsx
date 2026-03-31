import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { withUniwind } from 'uniwind';
import { TaskCard } from '@/components/task/TaskCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTasks, useProgress } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import { useGameTimer } from '@/hooks/useGameTimer';
import type { Task } from '@/services/api';
import { StyledSafeAreaView } from '@/lib/styled';


const EmptyState = (): React.JSX.Element => (
  <View className="flex-1 items-center justify-center py-20 px-8">
    <Ionicons name="clipboard-outline" size={48} color="#9CA3AF" />
    <Text className="text-lg font-semibold text-gray-900 text-center mb-2">
      Brak zadań
    </Text>
    <Text className="text-sm text-gray-500 text-center">
      Wróć na mapę i dołącz do gry, aby zobaczyć zadania.
    </Text>
  </View>
);

export default function TasksScreen(): React.JSX.Element {
  const { currentGame, currentSession, tasks } = useGameStore();
  const { isLoading, isFetching, refetch } = useTasks(currentGame?.id ?? '');
  useProgress(currentGame?.id ?? '');
  const router = useRouter();
  const timer = useGameTimer(currentGame?.endsAt);

  // No active game session — show empty state
  if (!currentSession) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
          <Text className="text-2xl font-extrabold text-secondary">Zadania</Text>
        </View>
        <EmptyState />
      </StyledSafeAreaView>
    );
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progress = tasks.length > 0 ? completedCount / tasks.length : 0;

  const handleTaskPress = (task: Task): void => {
    router.push({ pathname: '/(tabs)/tasks/[taskId]', params: { taskId: task.id, from: 'tasks' } } as never);
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-2xl font-extrabold text-secondary">
            Zadania
          </Text>
          {timer.formattedTime ? (
            <View className={`rounded-xl px-3 py-1.5 ${timer.totalSeconds <= 300 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Text className={`text-xs font-bold ${timer.totalSeconds <= 300 ? 'text-red-600' : 'text-gray-600'}`}>
                ⏱ {timer.formattedTime}
              </Text>
            </View>
          ) : null}
        </View>
        {currentGame ? (
          <Text className="text-sm text-gray-500 mb-3">{currentGame.name}</Text>
        ) : null}
        <View className="gap-1.5">
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">Postęp</Text>
            <Text className="text-xs font-semibold text-primary">
              {completedCount} / {tasks.length}
            </Text>
          </View>
          <ProgressBar progress={progress} />
        </View>
      </View>

      {/* Task list */}
      {isLoading && tasks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={handleTaskPress} />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => void refetch()}
              tintColor="#FF6B35"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </StyledSafeAreaView>
  );
}
