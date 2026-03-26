import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Podium } from '@/components/ranking/Podium';
import { RankItem } from '@/components/ranking/RankItem';
import { LiveIndicator } from '@/components/ranking/LiveIndicator';
import { useRankingStore } from '@/stores/rankingStore';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRanking } from '@/hooks/useGame';
import type { RankEntry } from '@/services/api';

const EmptyState = (): React.JSX.Element => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyEmoji}>🏆</Text>
    <Text style={styles.emptyTitle}>
      Brak danych rankingu
    </Text>
    <Text style={styles.emptySubtitle}>
      Dołącz do gry, aby zobaczyć ranking w czasie rzeczywistym.
    </Text>
  </View>
);

export default function RankingScreen(): React.JSX.Element {
  const { entries, isLive, setRanking } = useRankingStore();
  const { currentGame, currentSession } = useGameStore();
  const { user } = useAuthStore();
  const gameId = currentGame?.id ?? '';

  // Connect to WebSocket for the current session
  const { isConnected } = useWebSocket(currentSession?.id);

  // Initial fetch via game-scoped ranking endpoint
  const { isFetching, refetch } = useRanking(gameId);

  // Sync query result into ranking store
  const { data: rankingData } = useRanking(gameId);
  React.useEffect(() => {
    if (rankingData) {
      setRanking(rankingData);
    }
  }, [rankingData, setRanking]);

  const podiumEntries = entries.slice(0, 3);
  const restEntries = entries.slice(3);

  const renderItem = ({ item }: { item: RankEntry }) => (
    <RankItem entry={item} isCurrentUser={item.userId === user?.id} />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>
            Ranking
          </Text>
          <LiveIndicator isLive={isLive && isConnected} />
        </View>
        {currentSession ? (
          <Text style={styles.headerSubtitle}>
            {entries.length} graczy
          </Text>
        ) : null}
      </View>

      {isFetching && entries.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={restEntries}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          ListHeaderComponent={
            entries.length > 0 ? (
              <View style={styles.listHeaderContainer}>
                <Podium entries={podiumEntries} />
                {restEntries.length > 0 ? (
                  <Text style={styles.restLabel}>
                    Pozostali gracze
                  </Text>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            entries.length === 0 ? <EmptyState /> : null
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => void refetch()}
              tintColor="#FF6B35"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.secondary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.gray[500],
    marginTop: 2,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeaderContainer: {
    paddingBottom: 16,
  },
  restLabel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
}));
