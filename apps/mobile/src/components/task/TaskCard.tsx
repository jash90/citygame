import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '@/components/ui/Card';
import { TaskTypeBadge } from '@/components/ui/Badge';
import type { Task } from '@/services/api';

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

export const TaskCard = ({ task, onPress }: TaskCardProps): React.JSX.Element => {
  const isInteractive = task.status === 'available';
  const statusIcon = STATUS_ICONS[task.status];

  return (
    <TouchableOpacity
      onPress={() => isInteractive && onPress?.(task)}
      activeOpacity={isInteractive ? 0.7 : 1}
      style={styles.touchable}
    >
      <Card elevated style={styles.cardOpacity(task.status === 'locked')}>
        <View style={styles.row}>
          <Ionicons name={statusIcon.name} size={24} color={statusIcon.color} />

          <View style={styles.infoContainer}>
            <Text
              style={styles.title}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            <View style={styles.badgeRow}>
              <TaskTypeBadge type={task.type} />
              {task.timeLimitSec ? (
                <View style={styles.timeLimitRow}>
                  <Ionicons name="timer-outline" size={12} color="#6B7280" />
                  <Text style={styles.timeLimit}>
                    {Math.floor(task.timeLimitSec / 60)} min
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.pointsContainer}>
            <Text style={styles.points}>{task.points}</Text>
            <Text style={styles.pointsLabel}>pkt</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  touchable: {
    marginBottom: 12,
  },
  cardOpacity: (locked: boolean) => ({
    opacity: locked ? 0.6 : 1,
  }),
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  timeLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeLimit: {
    fontSize: 12,
    color: theme.colors.gray[500],
  },
  pointsContainer: {
    alignItems: 'center',
  },
  points: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  pointsLabel: {
    fontSize: 12,
    color: theme.colors.gray[500],
  },
}));
