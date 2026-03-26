import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Podium } from '@/components/ranking/Podium';
import { RankItem } from '@/components/ranking/RankItem';
import { LiveIndicator } from '@/components/ranking/LiveIndicator';
import { useRankingStore } from '@/stores/rankingStore';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRanking } from '@/hooks/useGame';
import type { RankEntry } from '@/services/api';
import { StyledSafeAreaView } from '@/lib/styled';


const EmptyState = (): React.JSX.Element => (
  <View className="flex-1 items-center justify-center py-16 px-8">
    <Ionicons name="trophy-outline" size={48} color="#9CA3AF" />
    <Text className="text-lg font-semibold text-gray-900 text-center mb-2">
      Brak danych rankingu
    </Text>
    <Text className="text-sm text-gray-500 text-center">
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
  const { data: rankingData, isFetching, refetch } = useRanking(gameId);

  // Sync query result into ranking store
  React.useEffect(() => {
    if (rankingData) {
      setRanking(rankingData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingData]);

  const podiumEntries = entries.slice(0, 3);
  const restEntries = entries.slice(3);

  const renderItem = ({ item }: { item: RankEntry }) => (
    <RankItem entry={item} isCurrentUser={item.userId === user?.id} />
  );

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-extrabold text-secondary">
            Ranking
          </Text>
          <LiveIndicator isLive={isLive && isConnected} />
        </View>
        {currentSession ? (
          <Text className="text-xs text-gray-500 mt-0.5">
            {entries.length} graczy
          </Text>
        ) : null}
      </View>

      {isFetching && entries.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={restEntries}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          ListHeaderComponent={
            entries.length > 0 ? (
              <View className="pb-4">
                <Podium entries={podiumEntries} />
                {restEntries.length > 0 ? (
                  <Text className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Pozostali gracze
                  </Text>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            entries.length === 0 ? <EmptyState /> : null
          }
          contentContainerStyle={{ paddingBottom: 24 }}
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
    </StyledSafeAreaView>
  );
}
