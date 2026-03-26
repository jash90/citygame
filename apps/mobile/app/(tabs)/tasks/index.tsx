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
import { StyleSheet } from 'react-native-unistyles';
import { TaskCard } from '@/components/task/TaskCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTasks } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import type { Task } from '@/services/api';

const EmptyState = (): React.JSX.Element => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyEmoji}>📋</Text>
    <Text style={styles.emptyTitle}>
      Brak zadań
    </Text>
    <Text style={styles.emptySubtitle}>
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Zadania
        </Text>
        {currentGame ? (
          <Text style={styles.headerSubtitle}>{currentGame.name}</Text>
        ) : null}
        <View style={styles.progressContainer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Postęp</Text>
            <Text style={styles.progressValue}>
              {completedCount} / {tasks.length}
            </Text>
          </View>
          <ProgressBar progress={progress} />
        </View>
      </View>

      {/* Task list */}
      {isFetching && tasks.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={handleTaskPress} />
          )}
          contentContainerStyle={styles.listContent}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.secondary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.gray[500],
    marginBottom: 12,
  },
  progressContainer: {
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: theme.colors.gray[500],
  },
  progressValue: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
}));
