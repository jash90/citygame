import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { withAlpha } from '@/lib/unistyles';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = ({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps): React.JSX.Element => {
  const { theme } = useUnistyles();
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles.containerVariant(variant),
        styles.containerSize(size),
        fullWidth ? styles.fullWidth : styles.selfStart,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'secondary' ? '#FFFFFF' : theme.colors.primary}
          style={styles.loader}
        />
      ) : null}
      <Text style={[styles.textSize(size), styles.textVariant(variant)]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerVariant: (variant: ButtonVariant) => {
    const map = {
      primary: { backgroundColor: theme.colors.primary },
      secondary: { backgroundColor: theme.colors.secondary },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: theme.colors.primary,
      },
      ghost: { backgroundColor: 'transparent' },
    };
    return map[variant];
  },
  containerSize: (size: ButtonSize) => {
    const map = {
      sm: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.borderRadius.lg },
      md: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: theme.borderRadius.xl },
      lg: { paddingHorizontal: 24, paddingVertical: 16, borderRadius: theme.borderRadius.xl },
    };
    return map[size];
  },
  textVariant: (variant: ButtonVariant) => {
    const map = {
      primary: { color: '#FFFFFF' },
      secondary: { color: '#FFFFFF' },
      outline: { color: theme.colors.primary },
      ghost: { color: theme.colors.primary },
    };
    return map[variant];
  },
  textSize: (size: ButtonSize) => {
    const map = {
      sm: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
      md: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold },
      lg: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
    };
    return map[size];
  },
  fullWidth: { width: '100%' },
  selfStart: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.5 },
  loader: { marginRight: 8 },
}));
