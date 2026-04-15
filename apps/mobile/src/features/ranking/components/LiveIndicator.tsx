import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface LiveIndicatorProps {
  isLive: boolean;
}

export const LiveIndicator = ({ isLive }: LiveIndicatorProps): React.JSX.Element => {
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
        {isLive ? 'Na żywo' : 'Rozłączono'}
      </Text>
    </View>
  );
};
