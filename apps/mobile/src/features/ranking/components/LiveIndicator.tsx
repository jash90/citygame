import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface LiveIndicatorProps {
  isLive: boolean;
  /** Wall-clock of the last successful ranking snapshot — shown as "od HH:MM" while disconnected. */
  lastUpdatedAt?: Date | null;
}

function formatHHMM(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const LiveIndicator = ({
  isLive,
  lastUpdatedAt,
}: LiveIndicatorProps): React.JSX.Element => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLive) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isLive, pulseAnim]);

  const offlineLabel = lastUpdatedAt
    ? `Ostatnio: ${formatHHMM(lastUpdatedAt)}`
    : 'Rozłączono';

  return (
    <View className="flex-row items-center gap-1.5">
      <Animated.View
        style={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          backgroundColor: isLive ? '#15803d' : '#9ca3af',
          opacity: isLive ? pulseAnim : 1,
        }}
      />
      <Text
        className={`text-xs font-semibold ${isLive ? 'text-green-700' : 'text-gray-400'}`}
      >
        {isLive ? 'Na żywo' : offlineLabel}
      </Text>
    </View>
  );
};
