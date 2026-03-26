import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/lib/unistyles';
import type { RankingEntry } from '@/services/api';

interface RankItemProps {
  entry: RankingEntry;
  isCurrentUser?: boolean;
}

export const RankItem = ({
  entry,
  isCurrentUser = false,
}: RankItemProps): React.JSX.Element => {
  return (
    <View style={styles.container(isCurrentUser)}>
      <View style={styles.rankNumberContainer}>
        <Text style={styles.rankNumber(isCurrentUser)}>
          {entry.rank}
        </Text>
      </View>

      <View style={styles.avatar(isCurrentUser)}>
        <Text style={styles.avatarText(isCurrentUser)}>
          {entry.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.nameContainer}>
        <Text
          style={styles.displayName(isCurrentUser)}
          numberOfLines={1}
        >
          {entry.displayName}
          {isCurrentUser ? ' (Ty)' : ''}
        </Text>
        <Text style={styles.completedTasks}>
          {entry.completedTasks} zadań ukończonych
        </Text>
      </View>

      <Text style={styles.points(isCurrentUser)}>
        {entry.points} pkt
      </Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: (isCurrentUser: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: isCurrentUser
      ? withAlpha(theme.colors.primary, 0.1)
      : '#FFFFFF',
    borderWidth: 1,
    borderColor: isCurrentUser
      ? withAlpha(theme.colors.primary, 0.3)
      : theme.colors.gray[100],
  }),
  rankNumberContainer: {
    width: 32,
    alignItems: 'center',
  },
  rankNumber: (isCurrentUser: boolean) => ({
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: isCurrentUser ? theme.colors.primary : theme.colors.gray[500],
  }),
  avatar: (isCurrentUser: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
    backgroundColor: isCurrentUser ? theme.colors.primary : theme.colors.gray[200],
  }),
  avatarText: (isCurrentUser: boolean) => ({
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: isCurrentUser ? '#FFFFFF' : theme.colors.gray[600],
  }),
  nameContainer: {
    flex: 1,
  },
  displayName: (isCurrentUser: boolean) => ({
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: isCurrentUser ? theme.colors.primary : theme.colors.gray[900],
  }),
  completedTasks: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[500],
  },
  points: (isCurrentUser: boolean) => ({
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: isCurrentUser ? theme.colors.primary : theme.colors.gray[800],
  }),
}));
