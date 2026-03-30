import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { GameCard } from './GameCard';
import { GamePrologueModal } from './GamePrologueModal';
import { useGames, useStartGame, useGame } from '@/hooks/useGame';
import type { Game } from '@/services/api';
import { StyledSafeAreaView } from '@/lib/styled';
import { Ionicons } from '@expo/vector-icons';

const EmptyState = (): React.JSX.Element => (
  <View className="flex-1 items-center justify-center py-20 px-8">
    <Ionicons name="map-outline" size={56} color="#6B7280" style={{ marginBottom: 16 }} />
    <Text className="text-lg font-semibold text-gray-900 text-center mb-2">
      Brak dostępnych gier
    </Text>
    <Text className="text-sm text-gray-500 text-center">
      Zajrzyj tu później — wkrótce pojawią się nowe miejskie przygody.
    </Text>
  </View>
);

export const GameBrowser = (): React.JSX.Element => {
  const { data: games, isLoading, isFetching, refetch } = useGames();
  const startGame = useStartGame();
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [prologueGame, setPrologueGame] = useState<Game | null>(null);

  useGame(joiningGameId ?? '');

  const handleJoin = (game: Game): void => {
    setJoiningGameId(game.id);
    startGame.mutate(game.id, {
      onSuccess: () => {
        if (game.narrative?.isNarrative && game.narrative.prologue) {
          setPrologueGame(game);
        }
      },
      onError: () => {
        setJoiningGameId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
        <Text className="text-2xl font-extrabold text-secondary">
          Wybierz grę
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          Odkryj miejskie przygody w Twojej okolicy
        </Text>
      </View>

      <FlatList
        data={games ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GameCard
            game={item}
            onJoin={handleJoin}
            isJoining={joiningGameId === item.id && startGame.isPending}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void refetch()}
            tintColor="#FF6B35"
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {prologueGame?.narrative ? (
        <GamePrologueModal
          visible={!!prologueGame}
          narrative={prologueGame.narrative}
          gameName={prologueGame.name}
          onStart={() => setPrologueGame(null)}
        />
      ) : null}
    </StyledSafeAreaView>
  );
};
