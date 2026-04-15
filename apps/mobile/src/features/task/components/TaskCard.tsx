import React, { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/shared/components/ui/Card';
import { TaskTypeBadge } from '@/shared/components/ui/Badge';
import type { Task } from '@/shared/types/api.types';
import { TouchableOpacity, View, Text } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS_ICONS: Record<Task['status'], { name: IoniconsName; color: string }> = {
  locked: { name: 'lock-closed', color: '#9CA3AF' },
  available: { name: 'play-circle', color: '#FF6B35' },
  completed: { name: 'checkmark-circle', color: '#22C55E' },
  failed: { name: 'close-circle', color: '#EF4444' },
};

interface TaskCardProps {
  task: Task;
  onPress?: (task: Task) => void;
}

export const TaskCard = memo(({ task, onPress }: TaskCardProps): React.JSX.Element => {
  const isInteractive = task.status === 'available' || (__DEV__ && task.status !== 'completed');
  const statusIcon = STATUS_ICONS[task.status];

  return (
    <TouchableOpacity
      onPress={() => isInteractive && onPress?.(task)}
      activeOpacity={isInteractive ? 0.7 : 1}
      className="mb-3"
      accessible
      accessibilityRole="button"
      accessibilityLabel={task.title}
    >
      <Card elevated style={{ opacity: task.status === 'locked' ? 0.6 : 1 }}>
        <View className="flex-row items-center gap-3">
          <Ionicons name={statusIcon.name} size={24} color={statusIcon.color} />

          <View className="flex-1">
            <Text
              className="text-base font-semibold text-gray-900 mb-1"
              numberOfLines={2}
            >
              {task.title}
            </Text>
            <View className="flex-row items-center gap-2 flex-wrap">
              <TaskTypeBadge type={task.type} />
              {task.timeLimitSec ? (
                <View className="flex-row items-center gap-0.5">
                  <Ionicons name="timer-outline" size={12} color="#6B7280" />
                  <Text className="text-xs text-gray-500">
                    {Math.floor(task.timeLimitSec / 60)} min
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="items-center">
            <Text className="text-xl font-bold text-primary">{task.points}</Text>
            <Text className="text-xs text-gray-500">pkt</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
});
