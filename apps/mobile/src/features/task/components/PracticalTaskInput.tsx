import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TaskSubmission } from '@citygame/shared';

const MIN_LENGTH = 10;

interface PracticalTaskInputProps {
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
  isSubmitting?: boolean;
  /** True when the player already has a PENDING attempt awaiting mentor review. */
  isPendingReview?: boolean;
}

/**
 * Practical task: player types a free-form description of what they did.
 * Submission goes to a mentor for manual review (see `practical.strategy.ts`).
 */
export const PracticalTaskInput = ({
  onSubmit,
  isSubmitting = false,
  isPendingReview = false,
}: PracticalTaskInputProps): React.JSX.Element => {
  const [description, setDescription] = useState('');

  if (isPendingReview) {
    return (
      <View className="gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="hourglass-outline" size={20} color="#FF6B35" />
          <Text className="text-base font-semibold text-orange-900">
            Oczekuje na ocenę mentora
          </Text>
        </View>
        <Text className="text-sm text-orange-800 leading-5">
          Twoje zgłoszenie zostało wysłane. Możesz wrócić później — gdy mentor
          oceni wykonanie, dostaniesz powiadomienie i przejdziesz do kolejnego
          zadania.
        </Text>
      </View>
    );
  }

  const canSubmit = description.trim().length >= MIN_LENGTH && !isSubmitting;

  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold text-gray-900">
        Opisz, w jaki sposób wykonałeś zadanie
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        placeholder="np. Spotkałem się z opiekunem Domu Kultury, dowiedziałem się o…"
        className="bg-white border border-gray-300 rounded-xl p-3 text-base text-gray-900 min-h-[120px]"
      />
      <Text className="text-xs text-gray-500">
        Minimum {MIN_LENGTH} znaków — mentor odczyta to przy ocenie.
      </Text>
      <TouchableOpacity
        onPress={() => onSubmit({ description: description.trim() })}
        disabled={!canSubmit}
        activeOpacity={0.8}
        className={`rounded-xl py-4 items-center bg-primary ${canSubmit ? '' : 'opacity-50'}`}
      >
        <Text className="text-white text-base font-bold">
          {isSubmitting ? 'Wysyłam…' : 'Wyślij do oceny mentora'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
