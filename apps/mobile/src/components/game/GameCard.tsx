import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Game } from '@/services/api';

interface GameCardProps {
  game: Game;
  onJoin: (game: Game) => void;
  onViewResults?: (game: Game) => void;
  isJoining?: boolean;
  hasActiveSession?: boolean;
  isExpired?: boolean;
  isRunning?: boolean;
}

export const GameCard = ({
  game,
  onJoin,
  onViewResults,
  isJoining = false,
  hasActiveSession = false,
  isExpired = false,
  isRunning = false,
}: GameCardProps): React.JSX.Element => {
  const renderActionButton = () => {
    if (isExpired) {
      // Game run ended — show View Results
      return (
        <TouchableOpacity
          className="bg-gray-200 rounded-lg px-5 py-2.5"
          onPress={() => onViewResults?.(game)}
          activeOpacity={0.8}
        >
          <Text className="text-gray-700 text-sm font-bold">Wyniki</Text>
        </TouchableOpacity>
      );
    }

    if (!isRunning && !hasActiveSession) {
      // Published but no active run — not joinable
      return (
        <View className="bg-gray-100 rounded-lg px-5 py-2.5">
          <Text className="text-gray-400 text-sm font-bold">Brak sesji</Text>
        </View>
      );
    }

    if (hasActiveSession) {
      return (
        <TouchableOpacity
          className="bg-green-600 rounded-lg px-5 py-2.5"
          onPress={() => onJoin(game)}
          disabled={isJoining}
          activeOpacity={0.8}
        >
          <Text className="text-white text-sm font-bold">
            {isJoining ? 'Ładowanie...' : 'Kontynuuj'}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
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
    );
  };

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

      {/* Status badge */}
      {isExpired ? (
        <View className="absolute top-3 right-3 bg-red-500/90 rounded-full px-3 py-1">
          <Text className="text-white text-[10px] font-bold">Zakończona</Text>
        </View>
      ) : isRunning ? (
        <View className="absolute top-3 right-3 bg-green-500/90 rounded-full px-3 py-1 flex-row items-center gap-1">
          <View className="w-1.5 h-1.5 rounded-full bg-white" />
          <Text className="text-white text-[10px] font-bold">Aktywna</Text>
        </View>
      ) : null}

      <View className="p-4 gap-3">
        <View>
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-bold text-secondary flex-1" numberOfLines={1}>
              {game.name}
            </Text>
            {game.narrative?.isNarrative ? (
              <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: '#1a1a2e' }}>
                <Ionicons name="book" size={10} color="#D4A574" />
                <Text className="text-[10px] font-semibold" style={{ color: '#D4A574' }}>Historia</Text>
              </View>
            ) : null}
          </View>
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
          {renderActionButton()}
        </View>
      </View>
    </View>
  );
};
