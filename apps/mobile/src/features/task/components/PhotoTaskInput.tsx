import React, { useState } from 'react';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TaskSubmission } from '@citygame/shared';

interface PhotoTaskInputProps {
  imageUrl?: string;
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
  isSubmitting?: boolean;
}

/**
 * PHOTO media-quiz task: player views an image the admin attached and types
 * a text answer (e.g. "what landmark is this?"). Verification happens
 * server-side in EXACT or AI mode — see photo.strategy.ts.
 */
export const PhotoTaskInput = ({
  imageUrl,
  onSubmit,
  isSubmitting = false,
}: PhotoTaskInputProps): React.JSX.Element => {
  const [answer, setAnswer] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const canSubmit = answer.trim().length > 0 && !isSubmitting;

  return (
    <View className="gap-4">
      {imageUrl ? (
        imageFailed ? (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="alert-circle" size={20} color="#dc2626" />
              <Text className="text-sm font-semibold text-red-900">
                Nie udało się załadować zdjęcia
              </Text>
            </View>
            <Text className="text-xs text-red-800">
              Sprawdź połączenie z internetem lub poproś admina o weryfikację
              linku.
            </Text>
          </View>
        ) : (
          <View className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            <Image
              source={{ uri: imageUrl }}
              resizeMode="cover"
              style={{ width: '100%', height: 240 }}
              accessibilityLabel="Zadanie ze zdjęciem"
              onError={() => setImageFailed(true)}
            />
          </View>
        )
      ) : (
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <Text className="text-sm text-gray-500 text-center">
            Brak zdjęcia dla tego zadania.
          </Text>
        </View>
      )}

      <View className="gap-2">
        <Text className="text-sm font-semibold text-gray-900">
          Co przedstawia zdjęcie?
        </Text>
        <TextInput
          value={answer}
          onChangeText={setAnswer}
          placeholder="np. Wawel"
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
        <View className="flex-row items-center gap-2">
          <Ionicons name="paper-plane-outline" size={18} color="#fff" />
          <Text className="text-white text-base font-bold">
            {isSubmitting ? 'Wysyłam…' : 'Wyślij odpowiedź'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};
