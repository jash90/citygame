import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/features/game/stores/gameStore';

interface QRTaskInputProps {
  onReady: (code: string) => void;
}

export const QRTaskInput = ({
  onReady,
}: QRTaskInputProps): React.JSX.Element => {
  const router = useRouter();
  const { lastScannedQR, setLastScannedQR } = useGameStore();
  const [scanned, setScanned] = useState<string | null>(null);

  useEffect(() => {
    if (lastScannedQR && lastScannedQR !== scanned) {
      setScanned(lastScannedQR);
      onReady(lastScannedQR);
      setLastScannedQR(null);
    }
  }, [lastScannedQR, scanned, onReady, setLastScannedQR]);

  const handleScan = (): void => {
    void router.push('/(modals)/qr-scanner' as never);
  };

  return (
    <View className="gap-3">
      <TouchableOpacity
        className={
          scanned
            ? 'border-2 border-dashed border-success rounded-xl p-8 items-center gap-3 bg-green-50'
            : 'border-2 border-dashed border-primary/40 rounded-xl p-8 items-center gap-3 bg-primary/5'
        }
        onPress={handleScan}
        activeOpacity={0.7}
      >
        <Ionicons name={scanned ? 'checkmark-circle' : 'qr-code-outline'} size={36} color={scanned ? '#22C55E' : '#FF6B35'} />
        <Text className="text-sm font-medium text-gray-600">
          {scanned ? `Zeskanowano: ${scanned}` : 'Dotknij, aby zeskanować kod QR'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
