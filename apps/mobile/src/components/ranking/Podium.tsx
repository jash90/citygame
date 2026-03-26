import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { RankingEntry } from '@/services/api';

const MEDAL_COLORS = {
  1: { bg: '#FFF8DC', border: '#FFD700', text: '#B8860B', emoji: '🥇' },
  2: { bg: '#F5F5F5', border: '#C0C0C0', text: '#708090', emoji: '🥈' },
  3: { bg: '#FDF5E6', border: '#CD7F32', text: '#8B4513', emoji: '🥉' },
} as const;

const PODIUM_HEIGHTS = { 1: 120, 2: 90, 3: 70 } as const;

interface PodiumItemProps {
  entry: RankingEntry;
  rank: 1 | 2 | 3;
}

const PodiumItem = ({ entry, rank }: PodiumItemProps): React.JSX.Element => {
  const medal = MEDAL_COLORS[rank];
  const height = PODIUM_HEIGHTS[rank];

  return (
    <View style={styles.podiumItem}>
      <Text style={styles.medalEmoji}>{medal.emoji}</Text>
      <View
        style={[
          styles.avatar,
          { borderColor: medal.border, backgroundColor: medal.bg },
        ]}
      >
        <Text style={[styles.avatarText, { color: medal.text }]}>
          {entry.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text
        style={styles.displayName}
        numberOfLines={1}
      >
        {entry.displayName}
      </Text>
      <Text style={styles.points}>
        {entry.points} pkt
      </Text>

      <View
        style={[
          styles.podiumBlock,
          {
            height,
            backgroundColor: medal.bg,
            borderWidth: 2,
            borderColor: medal.border,
            borderBottomWidth: 0,
          },
        ]}
      >
        <Text style={[styles.podiumRank, { color: medal.text }]}>
          {rank}
        </Text>
      </View>
    </View>
  );
};

interface PodiumProps {
  entries: RankingEntry[];
}

export const Podium = ({ entries }: PodiumProps): React.JSX.Element => {
  const [first, second, third] = entries;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {second ? (
          <PodiumItem entry={second} rank={2} />
        ) : (
          <View style={styles.flex1} />
        )}
        {first ? (
          <PodiumItem entry={first} rank={1} />
        ) : (
          <View style={styles.flex1} />
        )}
        {third ? (
          <PodiumItem entry={third} rank={3} />
        ) : (
          <View style={styles.flex1} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  medalEmoji: {
    fontSize: theme.fontSize['2xl'],
    marginBottom: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 4,
  },
  avatarText: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
  },
  displayName: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[800],
    marginBottom: 4,
    textAlign: 'center',
  },
  points: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.extrabold,
  },
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
}));
