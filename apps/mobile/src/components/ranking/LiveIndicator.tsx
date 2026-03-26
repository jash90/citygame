import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

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
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot(isLive),
          { opacity: isLive ? pulseAnim : 1 },
        ]}
      />
      <Text style={styles.label(isLive)}>
        {isLive ? 'Na żywo' : 'Rozłączono'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: (isLive: boolean) => ({
    width: 10,
    height: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: isLive ? theme.colors.green[700] : theme.colors.gray[400],
  }),
  label: (isLive: boolean) => ({
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: isLive ? theme.colors.green[700] : theme.colors.gray[400],
  }),
}));
