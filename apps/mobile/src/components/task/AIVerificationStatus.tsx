import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    <View className="flex-row items-center justify-center">
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
          <View className="gap-3">
            <Text className="text-sm font-semibold text-gray-700 text-center">
              Przesyłanie...
            </Text>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </View>
            <Text className="text-xs text-gray-500 text-center">
              {Math.round(progress)}%
            </Text>
          </View>
        );

      case 'processing':
        return (
          <View className="gap-4 items-center">
            <ProcessingDots />
            <Text className="text-sm font-semibold text-gray-700 text-center">
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
        const iconName = isCorrect ? 'checkmark-circle' as const : isPartial ? 'ellipse' as const : 'close-circle' as const;
        const iconColor = isCorrect ? '#22C55E' : isPartial ? '#F59E0B' : '#EF4444';

        const containerClassName = `rounded-2xl border p-4 gap-4 ${isCorrect
            ? 'bg-green-50 border-green-200'
            : isPartial
              ? 'bg-orange-50 border-orange-200'
              : 'bg-red-50 border-red-200'
          }`;

        const headerLabelClassName = `text-lg font-extrabold ${isCorrect
            ? 'text-green-700'
            : isPartial
              ? 'text-orange-600'
              : 'text-red-600'
          }`;

        return (
          <View className={containerClassName}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name={iconName} size={20} color={iconColor} />
                <Text className={headerLabelClassName}>{statusLabelText}</Text>
              </View>
              <ScoreCircle score={score} />
            </View>

            {feedback ? (
              <Text className="text-sm text-gray-700 leading-6">{feedback}</Text>
            ) : null}
          </View>
        );
      }

      case 'error':
        return (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-4 gap-3 items-center">
            <Ionicons name="warning" size={20} color="#F59E0B" />
            <Text className="text-sm font-semibold text-red-700 text-center">
              Wystąpił błąd podczas weryfikacji
            </Text>
            {onRetry ? (
              <TouchableOpacity
                className="bg-primary rounded-xl px-5 py-2.5"
                onPress={onRetry}
                activeOpacity={0.8}
              >
                <Text className="text-white font-bold text-sm">Spróbuj ponownie</Text>
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
