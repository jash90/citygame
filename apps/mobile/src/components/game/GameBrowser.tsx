import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { GameCard } from './GameCard';
import { useGames, useStartGame, useGame } from '@/hooks/useGame';
import type { Game } from '@/services/api';

const EmptyState = (): React.JSX.Element => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyEmoji}>🗺️</Text>
    <Text style={styles.emptyTitle}>
      Brak dostępnych gier
    </Text>
    <Text style={styles.emptySubtitle}>
      Zajrzyj tu później — wkrótce pojawią się nowe miejskie przygody.
    </Text>
  </View>
);

export const GameBrowser = (): React.JSX.Element => {
  const { data: games, isLoading, isFetching, refetch } = useGames();
  const startGame = useStartGame();
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);

  useGame(joiningGameId ?? '');

  const handleJoin = (game: Game): void => {
    setJoiningGameId(game.id);
    startGame.mutate(game.id, {
      onError: () => {
        setJoiningGameId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Wybierz grę
        </Text>
        <Text style={styles.headerSubtitle}>
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
        contentContainerStyle={styles.listContent}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  headerTitle: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.secondary,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[500],
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: 32,
  },
}));
