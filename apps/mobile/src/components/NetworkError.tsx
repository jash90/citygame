import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function NetworkError({
  message = 'Nie udało się załadować danych. Sprawdź połączenie z internetem.',
  onRetry,
}: Props): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center py-20 px-8">
      <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4">
        <Ionicons name="cloud-offline-outline" size={32} color="#EF4444" />
      </View>
      <Text className="text-lg font-semibold text-gray-900 text-center mb-2">
        Błąd połączenia
      </Text>
      <Text className="text-sm text-gray-500 text-center mb-6 leading-5">
        {message}
      </Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          className="bg-primary rounded-xl px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel="Spróbuj ponownie"
        >
          <Text className="text-white font-semibold text-sm">
            Spróbuj ponownie
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
