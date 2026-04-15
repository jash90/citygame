import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '@/features/game/stores/gameStore';
import { useHint } from '@/features/task/hooks/useTaskMutations';

const EMPTY_HINTS: { content: string; pointPenalty: number }[] = [];

interface HintsPanelProps {
  gameId: string;
  taskId: string;
  totalHints: number;
}

export const HintsPanel = ({
  gameId,
  taskId,
  totalHints,
}: HintsPanelProps): React.JSX.Element => {
  const hintMutation = useHint();
  const revealedHints = useGameStore(
    (s) => s.revealedHints.get(taskId) ?? EMPTY_HINTS,
  );
  const addRevealedHint = useGameStore((s) => s.addRevealedHint);

  const allUsed = revealedHints.length >= totalHints;

  const handleRevealHint = (): void => {
    Alert.alert(
      'Użyj podpowiedzi?',
      'Skorzystanie z podpowiedzi spowoduje odjęcie punktów.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Użyj podpowiedzi',
          onPress: () => {
            hintMutation.mutate(
              { gameId, taskId },
              {
                onSuccess: (result) => {
                  addRevealedHint(taskId, {
                    content: result.hint.content,
                    pointPenalty: result.hint.pointPenalty,
                  });
                },
                onError: () => {
                  Alert.alert('Błąd', 'Nie udało się pobrać podpowiedzi.');
                },
              },
            );
          },
        },
      ],
    );
  };

  return (
    <View className="gap-2">
      {revealedHints.map((hint, index) => (
        <View
          key={index}
          className="rounded-xl p-3 border border-amber-200 bg-amber-50"
        >
          <Text className="text-xs text-amber-600 font-semibold mb-1">
            Podpowiedź {index + 1}
            {hint.pointPenalty > 0 ? ` (-${hint.pointPenalty} pkt)` : ''}
          </Text>
          <Text className="text-sm text-amber-800">{hint.content}</Text>
        </View>
      ))}
      {!allUsed && (
        <TouchableOpacity
          className={`rounded-xl p-3 border border-gray-200 bg-gray-50 items-center ${hintMutation.isPending ? 'opacity-50' : 'opacity-100'}`}
          onPress={handleRevealHint}
          disabled={hintMutation.isPending}
          activeOpacity={0.8}
        >
          {hintMutation.isPending ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="bulb-outline" size={16} color="#6B7280" />
              <Text className="text-sm text-gray-500 text-center">
                Poproś o podpowiedź ({revealedHints.length}/{totalHints})
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
      {allUsed && revealedHints.length > 0 && (
        <Text className="text-xs text-gray-400 text-center py-1">
          Wykorzystano wszystkie podpowiedzi
        </Text>
      )}
    </View>
  );
};
