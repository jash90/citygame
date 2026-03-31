import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '@/stores/gameStore';
import { StyledSafeAreaView } from '@/lib/styled';

export default function GameEndedScreen(): React.JSX.Element {
  const router = useRouter();
  const { gameId, runNumber, totalPoints, tasksCompleted, totalTasks } =
    useLocalSearchParams<{
      gameId: string;
      runNumber: string;
      totalPoints: string;
      tasksCompleted: string;
      totalTasks: string;
    }>();

  const { reset, currentGame } = useGameStore();

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
  const run = parseInt(runNumber ?? '0', 10);

  const handleViewAnswers = (): void => {
    router.push({
      pathname: '/run-answers' as never,
      params: {
        gameId: gameId ?? '',
        runNumber: String(run),
        gameName: currentGame?.name ?? '',
      },
    });
  };

  const handleReturn = (): void => {
    reset();
    router.replace('/(tabs)/map' as never);
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 px-6 py-8 gap-8 items-center justify-center">
        {/* Clock icon animation */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          <View className="w-32 h-32 rounded-full bg-red-100 items-center justify-center">
            <Ionicons name="time" size={64} color="#EF4444" />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[{ opacity: opacityAnim }]}>
          <View className="items-center gap-2">
            <Text className="text-3xl font-extrabold text-secondary text-center">
              Czas minął!
            </Text>
            <Text className="text-base text-gray-500 text-center">
              Gra dobiegła końca. Sprawdź swoje wyniki.
            </Text>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[{ opacity: opacityAnim }, { width: '100%' }]}>
          <View className="w-full bg-gray-50 rounded-2xl p-5 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-500">Zdobyte punkty</Text>
              <View className="bg-primary rounded-xl px-4 py-1.5">
                <Text className="text-white font-extrabold text-lg">{points} pkt</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between border-t border-gray-100 pt-4">
              <Text className="text-sm text-gray-500">Ukończone zadania</Text>
              <Text className="text-sm font-bold text-secondary">
                {completed} / {total}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Bottom actions */}
      <View className="px-6 pb-8 gap-3">
        <TouchableOpacity
          className="bg-primary rounded-2xl py-4 items-center"
          onPress={handleViewAnswers}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-bold">Zobacz odpowiedzi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-gray-100 rounded-2xl py-4 items-center"
          onPress={handleReturn}
          activeOpacity={0.8}
        >
          <Text className="text-secondary text-base font-bold">Wróć do gier</Text>
        </TouchableOpacity>
      </View>
    </StyledSafeAreaView>
  );
}
