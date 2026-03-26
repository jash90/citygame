import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { AIVerificationStatus } from '@/components/task/AIVerificationStatus';

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Animated result icon */}
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            }}
          >
            <View style={styles.iconCircle(isSuccess)}>
              <Text style={styles.iconEmoji}>{isSuccess ? '🎉' : '😔'}</Text>
            </View>
          </Animated.View>

          {/* Result title */}
          <Animated.View style={[{ opacity: opacityAnim }, styles.resultContent]}>
            <Text style={styles.resultTitle(isSuccess)}>
              {isSuccess ? 'Doskonale!' : 'Niestety...'}
            </Text>

            {/* Points badge */}
            {isSuccess && pointsAwarded > 0 ? (
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsValue}>
                  +{pointsAwarded}
                </Text>
                <Text style={styles.pointsLabel}>punktów</Text>
              </View>
            ) : null}

            {/* AI verification result with score circle */}
            {showAiResult ? (
              <View style={styles.aiResultContainer}>
                <AIVerificationStatus
                  status="complete"
                  result={{
                    score: scoreValue!,
                    feedback: feedback ?? '',
                  }}
                />
              </View>
            ) : feedback ? (
              <Text style={styles.feedbackText}>
                {feedback}
              </Text>
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Bottom action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Dalej</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
    paddingVertical: 32,
  },
  iconCircle: (isSuccess: boolean) => ({
    width: 112,
    height: 112,
    borderRadius: 9999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: isSuccess ? theme.colors.green[100] : theme.colors.red[100],
  }),
  iconEmoji: {
    fontSize: 60,
  },
  resultContent: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  resultTitle: (isSuccess: boolean) => ({
    fontSize: 24,
    fontWeight: theme.fontWeight.extrabold,
    color: isSuccess ? theme.colors.green[700] : theme.colors.red[600],
  }),
  pointsBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsValue: {
    color: '#FFFFFF',
    fontWeight: theme.fontWeight.extrabold,
    fontSize: 20,
  },
  pointsLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
  },
  aiResultContainer: {
    width: '100%',
    marginTop: 8,
  },
  feedbackText: {
    fontSize: 16,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: 16 * 1.75,
    marginTop: 8,
  },
  bottomAction: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
  },
}));
