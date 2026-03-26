import React, { useEffect, useRef } from 'react';
import { View, Animated, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

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
  color = '#FF6B35',
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
      <View style={[styles.track, { height }]}>
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
        <Text style={styles.label}>
          {Math.round(clampedProgress * 100)}%
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  track: {
    width: '100%',
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    backgroundColor: theme.colors.gray[100],
  },
  label: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[500],
    marginTop: 4,
    textAlign: 'right',
  },
}));
