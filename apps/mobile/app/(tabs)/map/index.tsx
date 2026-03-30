import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { withUniwind } from 'uniwind';
import { Ionicons } from '@expo/vector-icons';
import { GameMap, type GameMapHandle } from '@/components/map/GameMap';
import { TaskPin } from '@/components/map/TaskPin';
import { GameBrowser } from '@/components/game/GameBrowser';
import { useLocation } from '@/hooks/useLocation';
import { useGameStore } from '@/stores/gameStore';
import type { Task } from '@/services/api';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export default function MapScreen(): React.JSX.Element {
  const { hasPermission, requestPermission } = useLocation();
  const { tasks, currentGame, currentSession, completedTaskIds, collectedClues } = useGameStore();
  const router = useRouter();
  const mapRef = useRef<GameMapHandle>(null);
  const [showJournal, setShowJournal] = useState(false);
  const isNarrative = currentGame?.narrative?.isNarrative;

  // No active session — show the game browser overlay (no location needed)
  if (!currentGame || !currentSession) {
    return <GameBrowser />;
  }

  // Location permission not granted — show locked screen
  if (hasPermission === false) {
    return (
      <View className="flex-1 bg-secondary items-center justify-center px-8">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(255,107,53,0.15)' }}
        >
          <Ionicons name="location-outline" size={40} color="#FF6B35" />
        </View>
        <Text className="text-2xl font-bold text-white text-center mb-3">
          Wymagana lokalizacja
        </Text>
        <Text className="text-base text-gray-400 text-center mb-8 leading-6">
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
          <Text className="text-gray-400 text-sm">Otwórz ustawienia</Text>
        </TouchableOpacity>
      </View>
    );
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
      <GameMap ref={mapRef}>
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

      {/* FAB buttons */}
      <StyledSafeAreaView edges={['bottom']} className="absolute bottom-4 right-4" pointerEvents="box-none">
        <View className="gap-3 items-center">
          {isNarrative ? (
            <TouchableOpacity
              className="w-12 h-12 rounded-full items-center justify-center shadow-md"
              style={{ backgroundColor: '#1a1a2e' }}
              activeOpacity={0.8}
              onPress={() => setShowJournal(true)}
            >
              <Ionicons name="book" size={20} color="#D4A574" />
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
                  <Ionicons name="book" size={18} color="#1a1a2e" />
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
                      <View className="w-7 h-7 rounded-full items-center justify-center mt-0.5" style={{ backgroundColor: '#1a1a2e' }}>
                        <Text className="text-xs font-bold" style={{ color: '#D4A574' }}>{i + 1}</Text>
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
