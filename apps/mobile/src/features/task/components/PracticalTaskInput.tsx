import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TaskSubmission } from '@citygame/shared';

interface PracticalTaskInputProps {
  /** Optional mentor rubric shown to the player as context for what to do. */
  criteria?: string;
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
  isSubmitting?: boolean;
  /** True when the player already has a PENDING attempt awaiting review. */
  isPendingReview?: boolean;
}

/**
 * Practical task: player completes the activity at a mentor station and just
 * sends an approval request. No text/media payload — submitting IS the
 * request. Mentor then approves at the station (see practical.strategy.ts).
 */
export const PracticalTaskInput = ({
  criteria,
  onSubmit,
  isSubmitting = false,
  isPendingReview = false,
}: PracticalTaskInputProps): React.JSX.Element => {
  if (isPendingReview) {
    return (
      <View className="gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="hourglass-outline" size={20} color="#FF6B35" />
          <Text className="text-base font-semibold text-orange-900">
            Oczekuje na zatwierdzenie
          </Text>
        </View>
        <Text className="text-sm text-orange-800 leading-5">
          Mentor zobaczy Twoje zgłoszenie i zatwierdzi wykonanie zadania. Gdy
          to zrobi, przejdziesz do kolejnego zadania.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {criteria ? (
        <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 gap-1">
          <Text className="text-xs font-semibold text-blue-800">
            Co należy zrobić
          </Text>
          <Text className="text-sm text-blue-900 leading-5">{criteria}</Text>
        </View>
      ) : null}

      <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 gap-2">
        <Text className="text-sm text-gray-700 leading-5">
          Wykonaj zadanie na stanowisku mentora, a następnie wyślij prośbę o
          zatwierdzenie. Mentor obserwuje i zatwierdzi wykonanie.
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => onSubmit({ requestedAt: new Date().toISOString() } as never)}
        disabled={isSubmitting}
        activeOpacity={0.8}
        className={`rounded-xl py-4 items-center bg-primary ${isSubmitting ? 'opacity-50' : ''}`}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="hand-right" size={18} color="#fff" />
          <Text className="text-white text-base font-bold">
            {isSubmitting ? 'Wysyłam…' : 'Poproś o zatwierdzenie'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};
