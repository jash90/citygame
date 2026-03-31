import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
interface TaskStoryContext {
  locationIntro?: string;
  taskNarrative?: string;
  clueRevealed?: string;
  characterName?: string;
}

interface StoryContextCardProps {
  context: TaskStoryContext;
}

export const StoryContextCard = ({ context }: StoryContextCardProps): React.JSX.Element | null => {
  if (!context.locationIntro && !context.taskNarrative) return null;

  return (
    <View className="rounded-2xl p-4 border border-amber-200 bg-amber-50">
      {context.characterName ? (
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="book-outline" size={14} color="#B45309" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            {context.characterName}
          </Text>
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
};
