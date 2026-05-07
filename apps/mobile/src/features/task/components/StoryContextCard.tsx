import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
interface TaskStoryContext {
  locationIntro?: string;
  taskNarrative?: string;
  clueRevealed?: string;
  characterName?: string;
}

interface StoryContextCardProps {
  context: TaskStoryContext;
  npcId?: string | null;
}

export const StoryContextCard = ({ context, npcId }: StoryContextCardProps): React.JSX.Element | null => {
  const router = useRouter();
  if (!context.locationIntro && !context.taskNarrative) return null;

  const content = (
    <View className="rounded-2xl p-4 border border-amber-200 bg-amber-50">
      {context.characterName ? (
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="book-outline" size={14} color="#B45309" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            {context.characterName}
          </Text>
          {npcId ? (
            <Ionicons name="chevron-forward" size={14} color="#B45309" />
          ) : null}
        </View>
      ) : null}

      {context.locationIntro ? (
        <Text className="text-sm leading-6 mb-2 text-amber-900">
          {context.locationIntro}
        </Text>
      ) : null}

      {context.taskNarrative ? (
        <Text className="text-sm leading-6 italic text-amber-700">
          {context.taskNarrative}
        </Text>
      ) : null}
    </View>
  );

  // Make the card clickable when there's an NPC to navigate to
  if (npcId) {
    return (
      <Pressable onPress={() => router.push(`/character/${npcId}` as never)}>
        {content}
      </Pressable>
    );
  }

  return content;
};
