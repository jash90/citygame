import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AIVerificationStatus } from '@/components/task/AIVerificationStatus';
import { StyledSafeAreaView } from '@/lib/styled';

export default function TaskResultModal(): React.JSX.Element {
  const router = useRouter();
  const { success, points, feedback, aiScore, isAiTask } = useLocalSearchParams<{
    success: string;
    points: string;
    feedback: string;
    aiScore?: string;
    isAiTask?: string;
  }>();

  const isSuccess = success === '1';
  const pointsAwarded = parseInt(points ?? '0', 10);
  const scoreValue = aiScore ? parseFloat(aiScore) : undefined;
  const showAiResult = isAiTask === '1' && scoreValue !== undefined;

  // Bounce animation for the icon
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handleContinue = (): void => {
    router.back();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center px-8 gap-6 py-8">
          {/* Animated result icon */}
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            }}
          >
            <View
              className={`w-28 h-28 rounded-full items-center justify-center ${isSuccess ? 'bg-green-100' : 'bg-red-100'
                }`}
            >
              <Ionicons name={isSuccess ? 'checkmark-circle' : 'close-circle'} size={64} color={isSuccess ? '#15803d' : '#dc2626'} />
            </View>
          </Animated.View>

          {/* Result title */}
          <Animated.View style={[{ opacity: opacityAnim }]}>
            <View className="items-center gap-2 w-full">
              <Text
                className={`text-2xl font-extrabold ${isSuccess ? 'text-green-700' : 'text-red-600'
                  }`}
              >
                {isSuccess ? 'Doskonale!' : 'Niestety...'}
              </Text>

              {/* Points badge */}
              {isSuccess && pointsAwarded > 0 ? (
                <View className="bg-primary rounded-2xl px-5 py-2 flex-row items-center gap-2">
                  <Text className="text-white font-extrabold text-xl">
                    +{pointsAwarded}
                  </Text>
                  <Text className="text-white text-sm font-semibold">punktów</Text>
                </View>
              ) : null}

              {/* AI verification result with score circle */}
              {showAiResult ? (
                <View className="w-full mt-2">
                  <AIVerificationStatus
                    status="complete"
                    result={{
                      score: scoreValue!,
                      feedback: feedback ?? '',
                    }}
                  />
                </View>
              ) : feedback ? (
                <Text className="text-base text-gray-600 text-center leading-7 mt-2">
                  {feedback}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Bottom action */}
      <View className="px-6 pb-8">
        <TouchableOpacity
          className="bg-primary rounded-2xl py-4 items-center"
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-bold">Dalej</Text>
        </TouchableOpacity>
      </View>
    </StyledSafeAreaView>
  );
}
