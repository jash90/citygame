import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRunAnswers } from '@/hooks/useGame';
import { StyledSafeAreaView } from '@/lib/styled';
import type { RunAnswerEntry } from '@/services/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  CORRECT: { label: 'Poprawna', color: '#16A34A', bg: 'bg-green-100', icon: 'checkmark-circle' },
  PARTIAL: { label: 'Częściowa', color: '#D97706', bg: 'bg-amber-100', icon: 'remove-circle' },
  INCORRECT: { label: 'Błędna', color: '#EF4444', bg: 'bg-red-100', icon: 'close-circle' },
  PENDING: { label: 'Oczekująca', color: '#6B7280', bg: 'bg-gray-100', icon: 'time' },
  ERROR: { label: 'Błąd', color: '#EF4444', bg: 'bg-red-100', icon: 'alert-circle' },
};

function AnswerItem({ item }: { item: RunAnswerEntry }): React.JSX.Element {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;

  return (
    <View className="bg-white rounded-xl border border-gray-100 p-4 mb-3 shadow-sm">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-base font-bold text-secondary" numberOfLines={2}>
            {item.taskTitle}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">{item.taskType}</Text>
        </View>
        <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${config.bg}`}>
          <Ionicons name={config.icon as any} size={12} color={config.color} />
          <Text className="text-[10px] font-bold" style={{ color: config.color }}>
            {config.label}
          </Text>
        </View>
      </View>

      <Text className="text-sm text-gray-600 mb-3" numberOfLines={3}>
        {item.taskDescription}
      </Text>

      {/* Points */}
      <View className="flex-row items-center justify-between border-t border-gray-100 pt-3">
        <Text className="text-xs text-gray-500">Punkty</Text>
        <Text className="text-sm font-bold text-primary">
          {item.pointsAwarded} / {item.maxPoints}
        </Text>
      </View>

      {/* AI feedback if available */}
      {item.aiResult && typeof item.aiResult === 'object' && 'feedback' in (item.aiResult as Record<string, unknown>) ? (
        <View className="mt-3 bg-blue-50 rounded-lg p-3">
          <Text className="text-xs font-semibold text-blue-700 mb-1">Ocena AI</Text>
          <Text className="text-xs text-blue-600">
            {(item.aiResult as Record<string, unknown>).feedback as string}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function RunAnswersScreen(): React.JSX.Element {
  const router = useRouter();
  const { gameId, runNumber, gameName } = useLocalSearchParams<{
    gameId: string;
    runNumber: string;
    gameName: string;
  }>();

  const run = parseInt(runNumber ?? '0', 10);
  const { data, isLoading } = useRunAnswers(gameId ?? '', run);

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
        <View className="flex-row items-center gap-3 mb-1">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-extrabold text-secondary">
              Odpowiedzi
            </Text>
            {gameName ? (
              <Text className="text-sm text-gray-500">{gameName}</Text>
            ) : null}
          </View>
        </View>

        {data?.session ? (
          <View className="flex-row items-center justify-between mt-2 bg-gray-50 rounded-xl px-4 py-2.5">
            <Text className="text-xs text-gray-500">Łączny wynik</Text>
            <Text className="text-sm font-bold text-primary">
              {data.session.totalPoints} pkt
            </Text>
          </View>
        ) : null}
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={data?.attempts ?? []}
          keyExtractor={(item, index) => `${item.taskId}-${index}`}
          renderItem={({ item }) => <AnswerItem item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
              <Text className="text-lg font-semibold text-gray-900 text-center mt-4 mb-2">
                Brak odpowiedzi
              </Text>
              <Text className="text-sm text-gray-500 text-center">
                Nie znaleziono odpowiedzi dla tej gry.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </StyledSafeAreaView>
  );
}
