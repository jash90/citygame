import React, { useEffect, useRef } from 'react';
import { View, Animated, Text } from 'react-native';
import { colors } from '@/lib/theme';


interface ProgressBarProps {
  progress: number; // 0 - 1
  showLabel?: boolean;
  height?: number;
  color?: string;
}

export const ProgressBar = ({
  progress,
  showLabel = false,
  height = 8,
  color = colors.primary,
}: ProgressBarProps): React.JSX.Element => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  const clampedProgress = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: clampedProgress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, animatedWidth]);

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View>
      <View
        className="w-full rounded-full overflow-hidden bg-gray-100"
        style={{ height }}
      >
        <Animated.View
          style={{
            height,
            width: widthInterpolated,
            backgroundColor: color,
            borderRadius: height / 2,
          }}
        />
      </View>
      {showLabel ? (
        <Text className="text-xs text-gray-500 mt-1 text-right">
          {Math.round(clampedProgress * 100)}%
        </Text>
      ) : null}
    </View>
  );
};
