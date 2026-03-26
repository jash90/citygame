import React from 'react';
import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import { StyleSheet } from 'react-native-unistyles';
import type { Task } from '@/services/api';

const TASK_TYPE_ICONS: Partial<Record<Task['type'], string>> = {
  QR_SCAN: '◻️',
  GPS_REACH: '📍',
  PHOTO_AI: '📷',
  AUDIO_AI: '🎙️',
  TEXT_EXACT: '✏️',
  TEXT_AI: '✏️',
  CIPHER: '🔐',
  MIXED: '🧩',
};

const STATUS_COLORS: Record<Task['status'], string> = {
  locked: '#9CA3AF',
  available: '#FF6B35',
  completed: '#22C55E',
  failed: '#EF4444',
};

interface TaskPinProps {
  task: Task;
  onPress?: (task: Task) => void;
}

export const TaskPin = ({ task, onPress }: TaskPinProps): React.JSX.Element | null => {
  if (!task.location) return null;

  const pinColor = STATUS_COLORS[task.status];
  const icon = TASK_TYPE_ICONS[task.type] ?? '📌';

  return (
    <Marker
      coordinate={{
        latitude: task.location.lat,
        longitude: task.location.lng,
      }}
      onPress={() => onPress?.(task)}
      tracksViewChanges={false}
    >
      <View style={styles.pinContainer}>
        <View
          style={[styles.pinCircle, { backgroundColor: pinColor }]}
        >
          <Text style={styles.pinIcon}>{icon}</Text>
        </View>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 6,
            borderRightWidth: 6,
            borderTopWidth: 8,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: pinColor,
          }}
        />
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create((theme) => ({
  pinContainer: {
    alignItems: 'center',
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...theme.shadows.md,
  },
  pinIcon: {
    fontSize: theme.fontSize.base,
  },
}));
