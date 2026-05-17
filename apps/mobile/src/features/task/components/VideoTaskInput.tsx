import React, { useState } from 'react';
import { Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TaskSubmission } from '@citygame/shared';

interface VideoTaskInputProps {
  videoUrl?: string;
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
  isSubmitting?: boolean;
}

/**
 * VIDEO media-quiz task: player watches a clip provided by the admin and
 * types a text answer. Verification happens server-side in EXACT or AI mode
 * — see video.strategy.ts.
 *
 * Until the app bundles a dedicated video player (e.g. expo-video), the
 * clip opens in the OS-default browser/player via Linking.openURL — the
 * answer flow is the same regardless of how the player consumed the video.
 */
export const VideoTaskInput = ({
  videoUrl,
  onSubmit,
  isSubmitting = false,
}: VideoTaskInputProps): React.JSX.Element => {
  const [answer, setAnswer] = useState('');
  const canSubmit = answer.trim().length > 0 && !isSubmitting;

  const openVideo = (): void => {
    if (videoUrl) void Linking.openURL(videoUrl);
  };

  return (
    <View className="gap-4">
      {videoUrl ? (
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 items-center gap-3">
          <Ionicons name="videocam" size={28} color="#2563eb" />
          <Text className="text-sm font-semibold text-gray-900 text-center">
            Obejrzyj wideo i wpisz odpowiedź
          </Text>
          <TouchableOpacity
            onPress={openVideo}
            className="bg-blue-600 rounded-full px-6 py-3 flex-row items-center gap-2"
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text className="text-white font-semibold">Odtwórz wideo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <Text className="text-sm text-gray-500 text-center">
            Brak nagrania wideo dla tego zadania.
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
          placeholder="np. Bach"
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
