import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { withUniwind } from 'uniwind';
import { Ionicons } from '@expo/vector-icons';
import { GameMap } from '@/components/map/GameMap';
import { TaskPin } from '@/components/map/TaskPin';
import { GameBrowser } from '@/components/game/GameBrowser';
import { useLocation } from '@/hooks/useLocation';
import { useGameStore } from '@/stores/gameStore';
import type { Task } from '@/services/api';
import { colors } from '@/lib/theme';

const StyledSafeAreaView = withUniwind(SafeAreaView);

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
    <View className="flex-1">
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
      <StyledSafeAreaView edges={['top']} className="absolute top-0 left-0 right-0" pointerEvents="none">
        <View className="mx-4 mt-2 bg-white/90 rounded-2xl px-4 py-3 flex-row items-center justify-between shadow-md">
          <View className="flex-1 mr-3">
            <Text className="text-xs text-gray-500">Aktywna gra</Text>
            <Text className="text-base font-bold text-secondary" numberOfLines={1}>
              {currentGame.name}
            </Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-400">{currentGame.city}</Text>
            </View>
          </View>
          <View className="bg-primary/10 rounded-xl px-3 py-1.5">
            <Text className="text-sm font-bold text-primary">
              {completedCount}/{totalCount} zadań
            </Text>
          </View>
        </View>
      </StyledSafeAreaView>

      {/* My location button */}
      <StyledSafeAreaView edges={['bottom']} className="absolute bottom-4 right-4" pointerEvents="box-none">
        <TouchableOpacity
          className="w-12 h-12 bg-surface rounded-full items-center justify-center shadow-md"
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
      </StyledSafeAreaView>
    </View>
  );
}
