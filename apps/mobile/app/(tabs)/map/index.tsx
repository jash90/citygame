import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { withUniwind } from 'uniwind';
import { Ionicons } from '@expo/vector-icons';
import { haversineDistance } from '@citygame/shared';
import { GameMap, type GameMapHandle } from '@/features/map/components/GameMap';
import { TaskPin } from '@/features/map/components/TaskPin';
import { GameBrowser } from '@/features/game/components/GameBrowser';
import { useLocation } from '@/features/map/hooks/useLocation';
import { useLocationStore } from '@/features/map/stores/locationStore';
import { filterVisibleTasks } from '@/features/map/utils/pinVisibility';

const PIN_TAP_DISTANCE_METERS = 10;
import { useProgress } from '@/features/game/hooks/useGameQueries';
import { useGameStore } from '@/features/game/stores/gameStore';
import { useGameTimer } from '@/features/game/hooks/useGameTimer';
import type { Task } from '@/shared/types/api.types';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export default function MapScreen(): React.JSX.Element {
  const { hasPermission, requestPermission } = useLocation();
  const { tasks, currentGame, currentSession, completedTaskIds, collectedClues, gameEnded, reset, setGameEnded } = useGameStore();
  const playerLocation = useLocationStore((s) => s.location);
  const router = useRouter();
  const mapRef = useRef<GameMapHandle>(null);
  const [showJournal, setShowJournal] = useState(false);
  const isNarrative = currentGame?.narrative?.isNarrative;
  const timer = useGameTimer(currentGame?.endsAt);
  useProgress(currentGame?.id ?? '');

  // Handle timer expiry or admin-ended run — navigate to game-ended screen
  useEffect(() => {
    if ((timer.isExpired || gameEnded) && currentGame && currentSession) {
      setGameEnded(true);
      router.replace({
        pathname: '/game-ended' as never,
        params: {
          gameId: currentGame.id,
          runNumber: String(currentGame.currentRun),
          totalPoints: String(currentSession.totalPoints),
          tasksCompleted: String(completedTaskIds.size),
          totalTasks: String(tasks.length),
        },
      });
    }
  }, [timer.isExpired, gameEnded]);

  // No active session — show the game browser overlay (no location needed)
  if (!currentGame || !currentSession) {
    return <GameBrowser />;
  }

  // Location permission not granted — show locked screen
  if (hasPermission === false) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-6">
          <Ionicons name="location-outline" size={40} color="#FF6B35" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
          Wymagana lokalizacja
        </Text>
        <Text className="text-base text-gray-500 text-center mb-8 leading-6">
          CityGame potrzebuje dostępu do Twojej lokalizacji, aby wyświetlać zadania na mapie i weryfikować Twoją pozycję.
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-2xl px-8 py-4 w-full items-center mb-3"
          activeOpacity={0.8}
          onPress={() => void requestPermission()}
        >
          <Text className="text-white font-bold text-base">Przyznaj dostęp</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="px-8 py-3 w-full items-center"
          activeOpacity={0.6}
          onPress={() => void Linking.openSettings()}
        >
          <Text className="text-gray-500 text-sm">Otwórz ustawienia</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleLeaveGame = (): void => {
    Alert.alert(
      'Opuść grę',
      'Czy na pewno chcesz opuścić grę? Możesz do niej wrócić z listy gier.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Opuść',
          style: 'destructive',
          onPress: () => reset(),
        },
      ],
    );
  };

  const handleTaskPinPress = (task: Task): void => {
    if (task.status === 'completed' || !task.location) return;

    if (!playerLocation) {
      Alert.alert('Brak lokalizacji', 'Poczekaj na ustalenie Twojej pozycji.');
      return;
    }

    const meters = haversineDistance(
      playerLocation.lat,
      playerLocation.lng,
      task.location.lat,
      task.location.lng,
    );

    if (meters > PIN_TAP_DISTANCE_METERS) {
      Alert.alert(
        'Podejdź bliżej',
        `Aby rozpocząć to zadanie, musisz być w odległości ${PIN_TAP_DISTANCE_METERS} m od punktu. Obecnie jesteś ~${Math.round(meters)} m.`,
      );
      return;
    }

    router.push({ pathname: '/(tabs)/tasks/[taskId]', params: { taskId: task.id, from: 'map' } } as never);
  };

  const completedCount = completedTaskIds.size;
  const totalCount = tasks.length;

  const visibleTasks = filterVisibleTasks({
    tasks,
    playerLocation,
    completedTaskIds,
    revealDistanceMeters: currentGame.pinRevealDistanceMeters,
  });

  return (
    <View className="flex-1">
      <GameMap ref={mapRef}>
        {visibleTasks.map((task) =>
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
      <StyledSafeAreaView edges={['top']} className="absolute top-0 left-0 right-0" pointerEvents="box-none">
        <View className="mx-4 mt-2 bg-white/90 rounded-2xl px-3 py-3 flex-row items-center shadow-md" pointerEvents="auto">
          {/* Back / leave button */}
          <TouchableOpacity
            onPress={handleLeaveGame}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>

          <View className="flex-1 mr-2">
            <Text className="text-xs text-gray-500">Aktywna gra</Text>
            <Text className="text-base font-bold text-secondary" numberOfLines={1}>
              {currentGame.name}
            </Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-400">{currentGame.city}</Text>
            </View>
          </View>

          <View className="items-end gap-1">
            <View className="bg-primary/10 rounded-xl px-3 py-1">
              <Text className="text-xs font-bold text-primary">
                {completedCount}/{totalCount}
              </Text>
            </View>
            {timer.formattedTime ? (
              <View className={`rounded-xl px-3 py-1 ${timer.totalSeconds <= 300 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Text className={`text-xs font-bold ${timer.totalSeconds <= 300 ? 'text-red-600' : 'text-gray-600'}`}>
                  ⏱ {timer.formattedTime}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </StyledSafeAreaView>

      {/* FAB buttons */}
      <StyledSafeAreaView edges={['bottom']} className="absolute bottom-4 right-4" pointerEvents="box-none">
        <View className="gap-3 items-center">
          {isNarrative ? (
            <TouchableOpacity
              className="w-12 h-12 rounded-full bg-surface items-center justify-center shadow-md border border-gray-100"
              activeOpacity={0.8}
              onPress={() => setShowJournal(true)}
            >
              <Ionicons name="book" size={20} color="#FF6B35" />
              {collectedClues.length > 0 ? (
                <View className="absolute -top-1 -right-1 bg-primary rounded-full w-5 h-5 items-center justify-center">
                  <Text className="text-white text-[10px] font-bold">{collectedClues.length}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            className="w-12 h-12 bg-surface rounded-full items-center justify-center shadow-md"
            activeOpacity={0.8}
            onPress={() => mapRef.current?.centerOnUser()}
          >
            <Ionicons name="locate" size={22} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </StyledSafeAreaView>

      {/* Clue journal modal */}
      {isNarrative ? (
        <Modal visible={showJournal} animationType="slide" transparent>
          <View className="flex-1 justify-end">
            <View className="bg-surface rounded-t-3xl max-h-[70%] shadow-2xl">
              <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="book" size={18} color="#FF6B35" />
                  <Text className="text-lg font-bold text-secondary">Dziennik wskazówek</Text>
                </View>
                <TouchableOpacity onPress={() => setShowJournal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView className="px-5 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
                {collectedClues.length === 0 ? (
                  <Text className="text-sm text-gray-400 text-center py-8">
                    Jeszcze nie odkryto żadnych wskazówek. Wykonuj zadania, aby zbierać fragmenty.
                  </Text>
                ) : (
                  collectedClues.map((clue, i) => (
                    <View key={i} className="flex-row gap-3 mb-4">
                      <View className="w-7 h-7 rounded-full bg-primary/10 items-center justify-center mt-0.5">
                        <Text className="text-xs font-bold text-primary">{i + 1}</Text>
                      </View>
                      <Text className="flex-1 text-sm italic text-gray-700 leading-6">„{clue}"</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
