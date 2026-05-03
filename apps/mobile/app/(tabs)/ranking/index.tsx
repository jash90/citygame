import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Podium } from '@/features/ranking/components/Podium';
import { RankItem } from '@/features/ranking/components/RankItem';
import { LiveIndicator } from '@/features/ranking/components/LiveIndicator';
import { NetworkError } from '@/shared/components/NetworkError';
import { useRankingStore } from '@/features/ranking/stores/rankingStore';
import { useGameStore } from '@/features/game/stores/gameStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useIsOnline } from '@/shared/providers/NetworkProvider';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { useRanking } from '@/features/ranking/hooks/useRanking';
import { useEffectiveRanking } from '@/features/ranking/hooks/useEffectiveRanking';
import type { RankEntry } from '@/shared/types/api.types';
import { StyledSafeAreaView } from '@/shared/lib/styled';

const NoSessionState = (): React.JSX.Element => (
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

const OfflineEmptyState = (): React.JSX.Element => (
  <View className="flex-1 items-center justify-center py-16 px-8">
    <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-4">
      <Ionicons name="cloud-offline-outline" size={32} color="#D97706" />
    </View>
    <Text className="text-lg font-semibold text-gray-900 text-center mb-2">
      Tryb offline
    </Text>
    <Text className="text-sm text-gray-500 text-center leading-5">
      Brak zapisanego rankingu na tym urządzeniu. Wróć do tego ekranu po
      odzyskaniu połączenia z internetem.
    </Text>
  </View>
);

export default function RankingScreen(): React.JSX.Element {
  const setRanking = useRankingStore((s) => s.setRanking);
  const isLive = useRankingStore((s) => s.isLive);
  const lastUpdatedAt = useRankingStore((s) => s.lastUpdatedAt);
  const { currentGame, currentSession } = useGameStore();
  const { user } = useAuthStore();
  const isOnline = useIsOnline();
  const gameId = currentGame?.id ?? '';

  // Connect to WebSocket for the current game (no-op when no gameId).
  const { isConnected } = useWebSocket(gameId || undefined);

  // Initial fetch via game-scoped ranking endpoint. React Query auto-pauses
  // while offline; cached entries from MMKV remain visible in the meantime.
  const { data: rankingData, isFetching, isError, error, refetch } = useRanking(gameId);

  // Sync server result into the persisted ranking store.
  React.useEffect(() => {
    if (rankingData) {
      setRanking(rankingData);
    }
  }, [rankingData, setRanking]);

  // Overlay local session score on top of cached entries so offline-completed
  // tasks are reflected in the user's own row immediately.
  const { entries, hasLocalOverride } = useEffectiveRanking();

  // No active game session — same empty state as before.
  if (!currentSession) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
          <Text className="text-2xl font-extrabold text-secondary">Ranking</Text>
        </View>
        <NoSessionState />
      </StyledSafeAreaView>
    );
  }

  const podiumEntries = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const hasEntries = entries.length > 0;
  const showSpinner = isFetching && !hasEntries;
  // Only treat REST errors as a network error when we actually have a chance
  // of reaching the server — otherwise prefer the offline-empty state.
  const showNetworkError = isOnline && isError && !hasEntries;
  const showOfflineEmpty = !isOnline && !hasEntries;

  const renderItem = ({ item }: { item: RankEntry }): React.JSX.Element => (
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
          <LiveIndicator
            isLive={isLive && isConnected && isOnline}
            lastUpdatedAt={lastUpdatedAt}
          />
        </View>
        <Text className="text-xs text-gray-500 mt-0.5">
          {entries.length} {entries.length === 1 ? 'gracz' : 'graczy'}
        </Text>
        {hasLocalOverride ? (
          <View className="flex-row items-center gap-1.5 mt-2">
            <Ionicons name="time-outline" size={12} color="#D97706" />
            <Text className="text-xs text-amber-700 flex-1">
              Twój wynik czeka na synchronizację z serwerem.
            </Text>
          </View>
        ) : null}
      </View>

      {showSpinner ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : showOfflineEmpty ? (
        <OfflineEmptyState />
      ) : showNetworkError ? (
        <NetworkError
          message={error?.message ?? 'Nie udało się załadować rankingu.'}
          onRetry={() => void refetch()}
        />
      ) : (
        <FlatList
          data={restEntries}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          ListHeaderComponent={
            hasEntries ? (
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
          ListEmptyComponent={!hasEntries ? <NoSessionState /> : null}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => void refetch()}
              tintColor="#FF6B35"
              // Pull-to-refresh while offline is a no-op for the network
              // request, but it lets the user trigger a recompute of the
              // local override and feels responsive.
              enabled={isOnline}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </StyledSafeAreaView>
  );
}
