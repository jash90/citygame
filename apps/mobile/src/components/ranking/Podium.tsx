import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RankingEntry } from '@/services/api';

const MEDAL_COLORS = {
  1: { bg: '#FFF8DC', border: '#FFD700', text: '#B8860B', icon: '#FFD700' },
  2: { bg: '#F5F5F5', border: '#C0C0C0', text: '#708090', icon: '#C0C0C0' },
  3: { bg: '#FDF5E6', border: '#CD7F32', text: '#8B4513', icon: '#CD7F32' },
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
    <View className="items-center flex-1">
      <Ionicons name="medal" size={28} color={medal.icon} />
      <View
        className="w-12 h-12 rounded-full items-center justify-center border-2 mt-1 mb-1"
        style={{ borderColor: medal.border, backgroundColor: medal.bg }}
      >
        <Text
          className="text-xl font-bold"
          style={{ color: medal.text }}
        >
          {entry.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text
        className="text-xs font-semibold text-gray-800 mb-1 text-center"
        numberOfLines={1}
      >
        {entry.displayName}
      </Text>
      <Text className="text-sm font-bold text-primary mb-1">
        {entry.totalPoints} pkt
      </Text>

      <View
        className="w-full rounded-t-lg items-center justify-center"
        style={{
          height,
          backgroundColor: medal.bg,
          borderWidth: 2,
          borderColor: medal.border,
          borderBottomWidth: 0,
        }}
      >
        <Text
          className="text-2xl font-extrabold"
          style={{ color: medal.text }}
        >
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
    <View className="px-4 pb-2">
      <View className="flex-row items-end gap-2">
        {second ? (
          <PodiumItem entry={second} rank={2} />
        ) : (
          <View className="flex-1" />
        )}
        {first ? (
          <PodiumItem entry={first} rank={1} />
        ) : (
          <View className="flex-1" />
        )}
        {third ? (
          <PodiumItem entry={third} rank={3} />
        ) : (
          <View className="flex-1" />
        )}
      </View>
    </View>
  );
};
