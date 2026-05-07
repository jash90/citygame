import React from 'react';
import { ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '@/features/game/stores/gameStore';
import { StyledSafeAreaView } from '@/shared/lib/styled';

export default function CharacterSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tasks, currentGame } = useGameStore();

  // Find the NPC from any task that references this character
  const npcTask = tasks.find(t => t.npc?.id === id);
  const npc = npcTask?.npc;

  if (!npc) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <Stack.Screen options={{ title: 'Postać', headerShown: true }} />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="person-outline" size={48} color="#9CA3AF" />
          <Text className="text-lg font-semibold text-gray-900 text-center mt-4">
            Postać nie znaleziona
          </Text>
          <Text className="text-sm text-gray-500 text-center mt-2">
            Może nie być jeszcze dostępna w tej grze.
          </Text>
        </View>
      </StyledSafeAreaView>
    );
  }

  // Find all tasks for this NPC
  const npcTasks = tasks.filter(t => t.npc?.id === id);
  const completedNpcTasks = npcTasks.filter(t => t.status === 'completed');

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ title: npc.name, headerShown: true }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <View className="flex-row items-center gap-3 mb-2">
            <View className="w-12 h-12 rounded-full bg-amber-100 items-center justify-center">
              <Ionicons name="person" size={24} color="#B45309" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {npc.name}
              </Text>
              <Text className="text-sm text-gray-500 italic">
                {npc.archetype}
              </Text>
            </View>
          </View>
          {npc.era ? (
            <View className="flex-row items-center gap-1 mt-1">
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-500">{npc.era}</Text>
            </View>
          ) : null}
          <View className="mt-3 pt-3 border-t border-gray-100">
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Głos
            </Text>
            <Text className="text-sm text-gray-700 italic leading-5">
              {npc.voiceTrait}
            </Text>
          </View>
        </View>

        {/* Tasks */}
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Zadania ({npcTasks.length})
            </Text>
            <Text className="text-xs text-gray-500">
              {completedNpcTasks.length}/{npcTasks.length} ukończono
            </Text>
          </View>
          {npcTasks.length === 0 ? (
            <Text className="text-sm text-gray-500 text-center py-4">
              Brak zadań przypisanych do tej postaci.
            </Text>
          ) : (
            npcTasks.map((task) => (
              <View
                key={task.id}
                className="flex-row items-center gap-3 py-3 border-b border-gray-50 last:border-b-0"
              >
                <Ionicons
                  name={task.status === 'completed' ? 'checkmark-circle' : 'play-circle-outline'}
                  size={20}
                  color={task.status === 'completed' ? '#22C55E' : '#FF6B35'}
                />
                <View className="flex-1">
                  <Text
                    className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-500' : 'text-gray-900'}`}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>
                  {task.taskRoleInArc ? (
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {task.taskRoleInArc === 'INTRODUCTION' && 'Wprowadzenie'}
                      {task.taskRoleInArc === 'DEEPENING' && 'Rozwinięcie'}
                      {task.taskRoleInArc === 'TWIST' && 'Zwrot akcji'}
                      {task.taskRoleInArc === 'CLIMAX' && 'Punkt kulminacyjny'}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-sm font-bold text-primary">
                  {task.points} pkt
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
