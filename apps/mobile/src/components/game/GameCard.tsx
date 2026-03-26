import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Game } from '@/services/api';

interface GameCardProps {
  game: Game;
  onJoin: (game: Game) => void;
  isJoining?: boolean;
}

export const GameCard = ({ game, onJoin, isJoining = false }: GameCardProps): React.JSX.Element => {
  return (
    <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4 shadow-sm">
      {game.coverImageUrl ? (
        <Image
          source={{ uri: game.coverImageUrl }}
          className="w-full"
          style={{ height: 160 }}
          resizeMode="cover"
        />
      ) : (
        <View className="w-full items-center justify-center bg-primary/10" style={{ height: 160 }}>
          <Ionicons name="map-outline" size={48} color="#FF6B35" />
        </View>
      )}
      <View className="p-4 gap-3">
        <View>
          <Text className="text-lg font-bold text-secondary" numberOfLines={1}>
            {game.name}
          </Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text className="text-sm text-gray-500">{game.city}</Text>
          </View>
        </View>
        {game.description ? (
          <Text className="text-sm text-gray-600 leading-5" numberOfLines={3}>
            {game.description}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-3">
            <View className="flex-row items-center gap-1">
              <Ionicons name="list-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-500">{game.taskCount} zadań</Text>
            </View>
            {game.duration ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="timer-outline" size={14} color="#6B7280" />
                <Text className="text-xs text-gray-500">~{game.duration} min</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            className={`bg-primary rounded-lg px-5 py-2.5 ${isJoining ? 'opacity-50' : ''}`}
            onPress={() => onJoin(game)}
            disabled={isJoining}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-bold">
              {isJoining ? 'Dołączanie...' : 'Dołącz'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
