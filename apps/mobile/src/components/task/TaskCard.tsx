import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '@/components/ui/Card';
import { TaskTypeBadge } from '@/components/ui/Badge';
import type { Task } from '@/services/api';

const STATUS_ICONS: Record<Task['status'], string> = {
  locked: '🔒',
  available: '▶️',
  completed: '✅',
  failed: '❌',
};

interface TaskCardProps {
  task: Task;
  onPress?: (task: Task) => void;
}

export const TaskCard = ({ task, onPress }: TaskCardProps): React.JSX.Element => {
  const isInteractive = task.status === 'available';

  return (
    <TouchableOpacity
      onPress={() => isInteractive && onPress?.(task)}
      activeOpacity={isInteractive ? 0.7 : 1}
      style={styles.touchable}
    >
      <Card elevated style={styles.cardOpacity(task.status === 'locked')}>
        <View style={styles.row}>
          <Text style={styles.statusIcon}>{STATUS_ICONS[task.status]}</Text>

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
                <Text style={styles.timeLimit}>
                  ⏱ {Math.floor(task.timeLimitSec / 60)} min
                </Text>
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
  statusIcon: {
    fontSize: 24,
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
