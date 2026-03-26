import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface AIVerificationResult {
  score: number;
  feedback: string;
}

export interface AIVerificationStatusProps {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  progress?: number;
  result?: AIVerificationResult;
  onRetry?: () => void;
}

const ScoreCircle = ({ score }: { score: number }): React.JSX.Element => {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const percentage = Math.round(score * 100);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: score,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillAnim, score]);

  const color = score >= 0.7 ? '#22c55e' : score >= 0.3 ? '#f97316' : '#ef4444';

  const size = 96;
  const borderWidth = 7;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.95,
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: '900', color }}>{percentage}%</Text>
    </View>
  );
};

const ProcessingDots = (): React.JSX.Element => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number): Animated.CompositeAnimation =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.delay(800 - delay),
        ]),
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value): object => ({
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
    marginHorizontal: 4,
    opacity: anim,
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
};

export const AIVerificationStatus = ({
  status,
  progress = 0,
  result,
  onRetry,
}: AIVerificationStatusProps): React.JSX.Element | null => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'idle') return;
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [status, fadeAnim]);

  if (status === 'idle') return null;

  const renderContent = (): React.JSX.Element => {
    switch (status) {
      case 'uploading':
        return (
          <View style={styles.gap3}>
            <Text style={styles.statusLabel}>
              Przesyłanie...
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.processingContainer}>
            <ProcessingDots />
            <Text style={styles.statusLabel}>
              AI analizuje Twoją odpowiedź...
            </Text>
          </View>
        );

      case 'complete': {
        if (!result) return <View />;
        const { score, feedback } = result;
        const isCorrect = score >= 0.7;
        const isPartial = score >= 0.3 && score < 0.7;

        const statusLabelText = isCorrect
          ? 'Poprawnie!'
          : isPartial
            ? 'Częściowo poprawnie'
            : 'Niepoprawnie';
        const icon = isCorrect ? '✅' : isPartial ? '🟡' : '❌';

        return (
          <View style={styles.completeContainer(isCorrect, isPartial)}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerIcon}>{icon}</Text>
                <Text style={styles.headerLabel(isCorrect, isPartial)}>{statusLabelText}</Text>
              </View>
              <ScoreCircle score={score} />
            </View>

            {feedback ? (
              <Text style={styles.feedbackText}>{feedback}</Text>
            ) : null}
          </View>
        );
      }

      case 'error':
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.headerIcon}>⚠️</Text>
            <Text style={styles.errorLabel}>
              Wystąpił błąd podczas weryfikacji
            </Text>
            {onRetry ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetry}
                activeOpacity={0.8}
              >
                <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
    }
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>{renderContent()}</Animated.View>
  );
};

const styles = StyleSheet.create((theme) => ({
  gap3: {
    gap: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray[700],
    textAlign: 'center',
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 9999,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
  processingContainer: {
    gap: 16,
    alignItems: 'center',
  },
  completeContainer: (isCorrect: boolean, isPartial: boolean) => ({
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    backgroundColor: isCorrect
      ? theme.colors.green[50]
      : isPartial
        ? theme.colors.orange[50]
        : theme.colors.red[50],
    borderColor: isCorrect
      ? theme.colors.green[200]
      : isPartial
        ? theme.colors.orange[200]
        : theme.colors.red[200],
  }),
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerLabel: (isCorrect: boolean, isPartial: boolean) => ({
    fontSize: 18,
    fontWeight: '800' as const,
    color: isCorrect
      ? theme.colors.green[700]
      : isPartial
        ? theme.colors.orange[600]
        : theme.colors.red[600],
  }),
  feedbackText: {
    fontSize: 14,
    color: theme.colors.gray[700],
    lineHeight: 14 * 1.75,
  },
  errorContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.red[200],
    backgroundColor: theme.colors.red[50],
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.red[700],
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
}));
