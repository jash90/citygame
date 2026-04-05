import React, { memo } from 'react';
import type { RankingEntry } from '@/services/api';
import { Text, View } from 'react-native';

interface RankItemProps {
  entry: RankingEntry;
  isCurrentUser?: boolean;
}

export const RankItem = memo(({
  entry,
  isCurrentUser = false,
}: RankItemProps): React.JSX.Element => {
  return (
    <View
      className={`flex-row items-center px-4 py-3 mx-4 mb-2 rounded-xl border ${
        isCurrentUser
          ? 'bg-primary/10 border-primary/30'
          : 'bg-white border-gray-100'
      }`}
    >
      <View className="w-8 items-center">
        <Text
          className={`text-base font-bold ${
            isCurrentUser ? 'text-primary' : 'text-gray-500'
          }`}
        >
          {entry.rank}
        </Text>
      </View>

      <View
        className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
          isCurrentUser ? 'bg-primary' : 'bg-gray-200'
        }`}
      >
        <Text
          className={`text-sm font-bold ${
            isCurrentUser ? 'text-white' : 'text-gray-600'
          }`}
        >
          {entry.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View className="flex-1">
        <Text
          className={`text-sm font-semibold ${
            isCurrentUser ? 'text-primary' : 'text-gray-900'
          }`}
          numberOfLines={1}
        >
          {entry.displayName}
          {isCurrentUser ? ' (Ty)' : ''}
        </Text>
        <Text className="text-xs text-gray-500">
          {entry.completedTasks} zadań ukończonych
        </Text>
      </View>

      <Text
        className={`text-base font-bold ${
          isCurrentUser ? 'text-primary' : 'text-gray-800'
        }`}
      >
        {entry.totalPoints} pkt
      </Text>
    </View>
  );
});
