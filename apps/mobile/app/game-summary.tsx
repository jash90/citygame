import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '@/stores/gameStore';
import { StyledSafeAreaView } from '@/lib/styled';

export default function GameSummaryScreen(): React.JSX.Element {
  const router = useRouter();
  const { totalPoints, tasksCompleted, totalTasks, timeTakenSec, rank } =
    useLocalSearchParams<{
      totalPoints: string;
      tasksCompleted: string;
      totalTasks: string;
      timeTakenSec: string;
      rank: string;
    }>();

  const { reset, currentGame, collectedClues } = useGameStore();
  const isNarrative = currentGame?.narrative?.isNarrative;

  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const points = parseInt(totalPoints ?? '0', 10);
  const completed = parseInt(tasksCompleted ?? '0', 10);
  const total = parseInt(totalTasks ?? '0', 10);
  const timeSec = parseInt(timeTakenSec ?? '0', 10);
  const finalRank = parseInt(rank ?? '0', 10);

  const timeMins = Math.floor(timeSec / 60);
  const timeSecs = timeSec % 60;
  const formattedTime =
    timeSec > 0
      ? `${String(timeMins).padStart(2, '0')}:${String(timeSecs).padStart(2, '0')}`
      : null;

  const handleReturn = (): void => {
    reset();
    // Navigate back to map (tab root)
    router.replace('/(tabs)/map' as never);
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-surface">
      <ScrollView
        contentContainerClassName="flex-1 px-6 py-8 gap-8 items-center justify-center"
        showsVerticalScrollIndicator={false}
      >
        {/* Trophy animation */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          <View className="w-32 h-32 rounded-full bg-amber-100 items-center justify-center">
            <Ionicons name="trophy" size={64} color="#FFD700" />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[{ opacity: opacityAnim }]}>
          <View className="items-center gap-2">
            <Text className="text-3xl font-extrabold text-secondary text-center">
              {isNarrative ? 'Rękopis odnaleziony!' : 'Gratulacje!'}
            </Text>
            <Text className="text-base text-gray-500 text-center">
              {isNarrative ? 'Rozwiązałeś zagadkę kronikarza' : 'Ukończyłeś grę miejską'}
            </Text>
          </View>
        </Animated.View>

        {/* Narrative epilogue */}
        {isNarrative && currentGame?.narrative?.epilogue ? (
          <Animated.View style={[{ opacity: opacityAnim }, { width: '100%' }]}>
            <View
              className="w-full rounded-2xl p-5 border border-amber-200/50"
              style={{ backgroundColor: '#1a1a2e' }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="book" size={14} color="#D4A574" />
                <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D4A574' }}>
                  Epilog
                </Text>
              </View>
              <Text className="text-sm leading-6" style={{ color: '#E8D5B7' }}>
                {currentGame.narrative.epilogue}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Collected clues */}
        {isNarrative && collectedClues.length > 0 ? (
          <Animated.View style={[{ opacity: opacityAnim }, { width: '100%' }]}>
            <View className="w-full bg-gray-50 rounded-2xl p-5">
              <Text className="text-sm font-bold text-secondary mb-3">Zebrane fragmenty</Text>
              {collectedClues.map((clue, i) => (
                <View key={i} className="flex-row gap-2 mb-2">
                  <Text className="text-xs font-bold text-primary">{i + 1}.</Text>
                  <Text className="flex-1 text-xs italic text-gray-600">„{clue}"</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {/* Stats grid */}
        <Animated.View style={[{ opacity: opacityAnim }, { width: '100%' }]}>
          <View className="w-full bg-gray-50 rounded-2xl p-5 gap-4">
            {/* Points */}
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-500">Zdobyte punkty</Text>
              <View className="bg-primary rounded-xl px-4 py-1.5">
                <Text className="text-white font-extrabold text-lg">{points} pkt</Text>
              </View>
            </View>

            {/* Tasks */}
            <View className="flex-row items-center justify-between border-t border-gray-100 pt-4">
              <Text className="text-sm text-gray-500">Ukończone zadania</Text>
              <Text className="text-sm font-bold text-secondary">
                {completed} / {total}
              </Text>
            </View>

            {/* Time */}
            {formattedTime ? (
              <View className="flex-row items-center justify-between border-t border-gray-100 pt-4">
                <Text className="text-sm text-gray-500">Czas gry</Text>
                <Text className="text-sm font-bold text-secondary">{formattedTime}</Text>
              </View>
            ) : null}

            {/* Rank */}
            {finalRank > 0 ? (
              <View className="flex-row items-center justify-between border-t border-gray-100 pt-4">
                <Text className="text-sm text-gray-500">Twoje miejsce</Text>
                <Text className="text-sm font-bold text-secondary">#{finalRank}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom action */}
      <View className="px-6 pb-8">
        <TouchableOpacity
          className="bg-primary rounded-2xl py-4 items-center"
          onPress={handleReturn}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-bold">Wróć do menu</Text>
        </TouchableOpacity>
      </View>
    </StyledSafeAreaView>
  );
}
