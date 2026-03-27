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
import { useTasks } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import type { Task } from '@/services/api';
import { StyledSafeAreaView } from '@/lib/styled';
import { colors } from '@/lib/theme';


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
  const { currentGame, tasks } = useGameStore();
  const { isFetching, refetch } = useTasks(currentGame?.id ?? '');
  const router = useRouter();

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progress = tasks.length > 0 ? completedCount / tasks.length : 0;

  const handleTaskPress = (task: Task): void => {
    router.push(`/(tabs)/tasks/${task.id}` as never);
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
        <Text className="text-2xl font-extrabold text-secondary mb-1">
          Zadania
        </Text>
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
      {isFetching && tasks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
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
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </StyledSafeAreaView>
  );
}
