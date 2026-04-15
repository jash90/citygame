import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocationStore } from '@/features/map/stores/locationStore';
import type { Task } from '@/shared/types/api.types';

interface GPSTaskInputProps {
  task: Task;
  onReady: (coords: { latitude: number; longitude: number }) => void;
}

export const GPSTaskInput = ({
  task,
  onReady,
}: GPSTaskInputProps): React.JSX.Element => {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerLocation = useLocationStore((s) => s.location);

  const handleCheck = (): void => {
    if (!playerLocation) {
      setError('Brak sygnału GPS. Upewnij się, że lokalizacja jest włączona.');
      return;
    }
    setError(null);
    setVerified(true);
    onReady({ latitude: playerLocation.lat, longitude: playerLocation.lng });
  };

  return (
    <View className="gap-3">
      {task.location ? (
        <View className="bg-gray-50 rounded-xl p-3">
          <Text className="text-xs text-gray-500 mb-1">Cel:</Text>
          <Text className="text-sm font-medium text-gray-700">
            {task.location.lat.toFixed(5)}, {task.location.lng.toFixed(5)}
          </Text>
          <Text className="text-xs text-gray-500 mt-1">
            Promień: {task.location.radiusMeters} m
          </Text>
        </View>
      ) : null}
      {error ? (
        <View className="bg-red-50 rounded-xl p-3">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        className={
          verified
            ? 'border-2 border-dashed border-success rounded-xl p-8 items-center gap-3 bg-green-50'
            : 'border-2 border-dashed border-primary/40 rounded-xl p-8 items-center gap-3 bg-primary/5'
        }
        onPress={handleCheck}
        activeOpacity={0.7}
      >
        <Ionicons name={verified ? 'checkmark-circle' : 'location'} size={36} color={verified ? '#22C55E' : '#FF6B35'} />
        <Text className="text-sm font-medium text-gray-600">
          {verified
            ? 'Lokalizacja zweryfikowana!'
            : 'Dotknij, aby sprawdzić lokalizację GPS'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
