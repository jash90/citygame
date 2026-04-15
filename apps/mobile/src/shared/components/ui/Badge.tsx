import React from 'react';
import { View, Text } from 'react-native';
import type { TaskType, TaskStatus } from '@/shared/types/api.types';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const CONTAINER_VARIANT: Record<BadgeVariant, string> = {
  default: 'bg-gray-100',
  primary: 'bg-primary/15',
  success: 'bg-green-100',
  warning: 'bg-amber-100',
  error: 'bg-red-100',
  muted: 'bg-gray-50',
};

const TEXT_VARIANT: Record<BadgeVariant, string> = {
  default: 'text-gray-700',
  primary: 'text-primary',
  success: 'text-green-700',
  warning: 'text-amber-700',
  error: 'text-red-700',
  muted: 'text-gray-500',
};

export const Badge = ({
  label,
  variant = 'default',
  size = 'sm',
}: BadgeProps): React.JSX.Element => {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View className={`rounded-full items-center justify-center self-start ${sizeClass} ${CONTAINER_VARIANT[variant]}`}>
      <Text className={`font-semibold ${textSizeClass} ${TEXT_VARIANT[variant]}`}>
        {label}
      </Text>
    </View>
  );
};

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
