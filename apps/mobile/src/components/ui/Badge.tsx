import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/lib/unistyles';
import type { TaskType, TaskStatus } from '@/services/api';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export const Badge = ({
  label,
  variant = 'default',
  size = 'sm',
}: BadgeProps): React.JSX.Element => {
  return (
    <View style={[styles.base, styles.containerSize(size), styles.containerVariant(variant)]}>
      <Text style={[styles.text, styles.textSize(size), styles.textVariant(variant)]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  base: {
    borderRadius: theme.borderRadius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    alignSelf: 'flex-start' as const,
  },
  containerSize: (size: 'sm' | 'md') => ({
    paddingHorizontal: size === 'sm' ? 8 : 12,
    paddingVertical: size === 'sm' ? 2 : 4,
  }),
  containerVariant: (variant: BadgeVariant) => {
    const colors: Record<BadgeVariant, string> = {
      default: theme.colors.gray[100],
      primary: withAlpha(theme.colors.primary, 0.15),
      success: theme.colors.green[100],
      warning: theme.colors.amber[100],
      error: theme.colors.red[100],
      muted: theme.colors.gray[50],
    };
    return { backgroundColor: colors[variant] };
  },
  text: {
    fontWeight: theme.fontWeight.semibold,
  },
  textSize: (size: 'sm' | 'md') => ({
    fontSize: size === 'sm' ? theme.fontSize.xs : theme.fontSize.sm,
  }),
  textVariant: (variant: BadgeVariant) => {
    const colors: Record<BadgeVariant, string> = {
      default: theme.colors.gray[700],
      primary: theme.colors.primary,
      success: theme.colors.green[700],
      warning: theme.colors.amber[700],
      error: theme.colors.red[700],
      muted: theme.colors.gray[500],
    };
    return { color: colors[variant] };
  },
}));

// Task type labels matching backend TaskType enum
const TASK_TYPE_LABELS: Record<TaskType, string> = {
  QR_SCAN: 'Kod QR',
  GPS_REACH: 'GPS',
  PHOTO_AI: 'Foto AI',
  AUDIO_AI: 'Audio AI',
  TEXT_EXACT: 'Tekst',
  TEXT_AI: 'Tekst AI',
  CIPHER: 'Szyfr',
  MIXED: 'Mieszane',
};

const TASK_TYPE_VARIANTS: Record<TaskType, BadgeVariant> = {
  QR_SCAN: 'warning',
  GPS_REACH: 'success',
  PHOTO_AI: 'primary',
  AUDIO_AI: 'primary',
  TEXT_EXACT: 'default',
  TEXT_AI: 'default',
  CIPHER: 'error',
  MIXED: 'muted',
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  locked: 'Zablokowane',
  available: 'Dostępne',
  completed: 'Ukończone',
  failed: 'Nieudane',
};

const TASK_STATUS_VARIANTS: Record<TaskStatus, BadgeVariant> = {
  locked: 'muted',
  available: 'primary',
  completed: 'success',
  failed: 'error',
};

export const TaskTypeBadge = ({ type }: { type: TaskType }): React.JSX.Element => (
  <Badge label={TASK_TYPE_LABELS[type]} variant={TASK_TYPE_VARIANTS[type]} />
);

export const TaskStatusBadge = ({ status }: { status: TaskStatus }): React.JSX.Element => (
  <Badge label={TASK_STATUS_LABELS[status]} variant={TASK_STATUS_VARIANTS[status]} />
);
