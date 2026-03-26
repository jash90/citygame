import React, { type ReactNode } from 'react';
import { View, Platform, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface CardProps extends ViewProps {
  children: ReactNode;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = ({
  children,
  elevated = false,
  padding = 'md',
  style,
  ...props
}: CardProps): React.JSX.Element => {
  return (
    <View
      style={[
        styles.base,
        elevated ? styles.elevated : styles.bordered,
        styles.padding(padding),
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  base: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
  },
  elevated: {
    ...theme.shadows.md,
    ...(Platform.OS === 'ios' ? { shadowOpacity: 0.1 } : {}),
  },
  bordered: {
    borderWidth: 1,
    borderColor: theme.colors.gray[100],
  },
  padding: (size: 'none' | 'sm' | 'md' | 'lg') => {
    const map = {
      none: {},
      sm: { padding: 12 },
      md: { padding: 16 },
      lg: { padding: 20 },
    };
    return map[size];
  },
}));
