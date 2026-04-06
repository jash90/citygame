import React, { useState, useCallback } from 'react';
import { Platform, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { Task } from '@/services/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TASK_TYPE_ICONS: Partial<Record<Task['type'], IoniconsName>> = {
  QR_SCAN: 'qr-code-outline',
  GPS_REACH: 'navigate',
  PHOTO_AI: 'camera',
  AUDIO_AI: 'mic',
  TEXT_EXACT: 'pencil',
  TEXT_AI: 'pencil',
  CIPHER: 'lock-closed',
  MIXED: 'cube',
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
  const icon = TASK_TYPE_ICONS[task.type] ?? 'location';

  // On Android, custom marker views need at least one render pass with
  // tracksViewChanges=true before they can be frozen. We flip the flag
  // after the view has been laid out to avoid the "invisible pin" bug.
  const [rendered, setRendered] = useState(Platform.OS !== 'android');
  const handleLayout = useCallback(() => {
    if (!rendered) setRendered(true);
  }, [rendered]);

  return (
    <Marker
      coordinate={{
        latitude: task.location.lat,
        longitude: task.location.lng,
      }}
      onPress={() => onPress?.(task)}
      tracksViewChanges={!rendered}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={{ alignItems: 'center' }} onLayout={handleLayout}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#FFFFFF',
            backgroundColor: pinColor,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                }
              : { elevation: 4 }),
          }}
        >
          <Ionicons name={icon} size={18} color="#FFFFFF" />
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
