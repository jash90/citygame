import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { TaskSubmission } from '@citygame/shared';

interface AudioTaskInputProps {
  /** Admin-provided audio clip the player has to identify. */
  audioUrl?: string;
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
  isSubmitting?: boolean;
}

/**
 * AUDIO media-quiz task: player listens to a clip provided by the admin and
 * types a text answer (e.g. "what animal makes this sound?"). Verification
 * happens server-side in EXACT or AI mode — see audio.strategy.ts.
 */
export const AudioTaskInput = ({
  audioUrl,
  onSubmit,
  isSubmitting = false,
}: AudioTaskInputProps): React.JSX.Element => {
  const [answer, setAnswer] = useState('');

  const player = useAudioPlayer(audioUrl ? { uri: audioUrl } : null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status?.playing ?? false;
  // expo-audio surfaces playback errors via the status object; the exact
  // shape varies by SDK version, so we check loosely.
  const loadError =
    status &&
    typeof status === 'object' &&
    ('error' in status
      ? (status as { error?: unknown }).error
      : null);

  const togglePlay = (): void => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.seekTo(0);
      player.play();
    }
  };

  const canSubmit = answer.trim().length > 0 && !isSubmitting;

  return (
    <View className="gap-4">
      {audioUrl ? (
        loadError ? (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="alert-circle" size={20} color="#dc2626" />
              <Text className="text-sm font-semibold text-red-900">
                Nie udało się załadować nagrania
              </Text>
            </View>
            <Text className="text-xs text-red-800">
              Sprawdź połączenie z internetem lub poproś admina o weryfikację linku.
            </Text>
          </View>
        ) : (
          <View className="bg-orange-50 border border-orange-200 rounded-xl p-4 items-center gap-3">
            <Ionicons name="musical-notes" size={28} color="#FF6B35" />
            <Text className="text-sm font-semibold text-gray-900">
              Posłuchaj nagrania i wpisz odpowiedź
            </Text>
            <TouchableOpacity
              onPress={togglePlay}
              className="bg-primary rounded-full px-6 py-3 flex-row items-center gap-2"
              activeOpacity={0.8}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color="#fff"
              />
              <Text className="text-white font-semibold">
                {isPlaying ? 'Zatrzymaj' : 'Odtwórz'}
              </Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <Text className="text-sm text-gray-500 text-center">
            Brak nagrania dla tego zadania.
          </Text>
        </View>
      )}

      <View className="gap-2">
        <Text className="text-sm font-semibold text-gray-900">
          Twoja odpowiedź
        </Text>
        <TextInput
          value={answer}
          onChangeText={setAnswer}
          placeholder="np. pies"
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-base text-gray-900"
        />
      </View>

      <TouchableOpacity
        onPress={() => onSubmit({ answer: answer.trim() })}
        disabled={!canSubmit}
        activeOpacity={0.8}
        className={`rounded-xl py-4 items-center bg-primary ${canSubmit ? '' : 'opacity-50'}`}
      >
        <Text className="text-white text-base font-bold">
          {isSubmitting ? 'Wysyłam…' : 'Wyślij odpowiedź'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
