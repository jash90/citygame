import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/lib/unistyles';
import { GameMap } from '@/components/map/GameMap';
import { TaskPin } from '@/components/map/TaskPin';
import { GameBrowser } from '@/components/game/GameBrowser';
import { useLocation } from '@/hooks/useLocation';
import { useGameStore } from '@/stores/gameStore';
import type { Task } from '@/services/api';

export default function MapScreen(): React.JSX.Element {
  const { hasPermission, requestPermission } = useLocation();
  const { tasks, currentGame, currentSession, completedTaskIds } = useGameStore();
  const router = useRouter();

  useEffect(() => {
    if (hasPermission === false) {
      Alert.alert(
        'Brak uprawnień',
        'Aplikacja potrzebuje dostępu do lokalizacji, aby wyświetlać zadania na mapie.',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Przyznaj dostęp',
            onPress: () => void requestPermission(),
          },
        ],
      );
    }
  }, [hasPermission, requestPermission]);

  // No active session — show the game browser overlay
  if (!currentGame || !currentSession) {
    return <GameBrowser />;
  }

  const handleTaskPinPress = (task: Task): void => {
    if (task.status === 'locked') {
      // Navigate to task detail where the unlock flow lives
      router.push(`/(tabs)/tasks/${task.id}` as never);
    } else if (task.status === 'available') {
      router.push(`/(tabs)/tasks/${task.id}` as never);
    }
    // completed tasks are not interactive from the map
  };

  const completedCount = completedTaskIds.size;
  const totalCount = tasks.length;

  return (
    <View style={styles.flex1}>
      <GameMap>
        {tasks.map((task) =>
          task.location ? (
            <TaskPin
              key={task.id}
              task={task}
              onPress={handleTaskPinPress}
            />
          ) : null,
        )}
      </GameMap>

      {/* Floating header overlay */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay} pointerEvents="none">
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>Aktywna gra</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentGame.name}
            </Text>
            <Text style={styles.headerCity}>📍 {currentGame.city}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {completedCount}/{totalCount} zadań
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* My location button */}
      <SafeAreaView edges={['bottom']} style={styles.locationBtnContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.locationBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.locationBtnEmoji}>📍</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex1: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...theme.shadows.md,
    shadowColor: 'rgba(0,0,0,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerLabel: {
    fontSize: 12,
    color: theme.colors.gray[500],
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.secondary,
  },
  headerCity: {
    fontSize: 12,
    color: theme.colors.gray[400],
  },
  headerBadge: {
    backgroundColor: withAlpha(theme.colors.primary, 0.1),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeText: {
    fontSize: 14,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  locationBtnContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  locationBtn: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.surface,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
    shadowColor: 'rgba(0,0,0,0.1)',
  },
  locationBtnEmoji: {
    fontSize: 20,
  },
}));
