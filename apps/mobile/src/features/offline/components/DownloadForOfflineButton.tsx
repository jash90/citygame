import React, { useState } from 'react';
import { Alert, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  downloadOfflineBundle,
  deleteOfflineBundle,
} from '@/features/offline/services/bundleDownloader';
import {
  selectBundle,
  useOfflineBundleStore,
} from '@/features/offline/stores/offlineBundleStore';

interface DownloadForOfflineButtonProps {
  gameId: string;
  /** Optional compact pill style for game-card overlays. */
  compact?: boolean;
}

export const DownloadForOfflineButton = ({
  gameId,
  compact,
}: DownloadForOfflineButtonProps): React.JSX.Element => {
  const stored = useOfflineBundleStore(selectBundle(gameId));
  const [busy, setBusy] = useState(false);

  const status = stored?.status.kind ?? 'idle';
  const isReady = status === 'ready';
  const isDownloading = status === 'downloading' || busy;

  const handlePress = async (): Promise<void> => {
    if (isDownloading) return;
    if (isReady) {
      Alert.alert(
        'Usunąć pobraną grę?',
        'Pobrane mapy, zadania i zdjęcia zostaną usunięte z urządzenia.',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Usuń',
            style: 'destructive',
            onPress: () => {
              void deleteOfflineBundle(gameId);
            },
          },
        ],
      );
      return;
    }
    setBusy(true);
    try {
      await downloadOfflineBundle(gameId);
    } catch {
      Alert.alert('Błąd pobierania', 'Nie udało się pobrać paczki offline. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  };

  const label = isReady
    ? 'Pobrane'
    : isDownloading
      ? 'Pobieranie…'
      : 'Pobierz do gry offline';
  const icon = isReady ? 'checkmark-circle' : 'cloud-download-outline';
  const containerClass = compact
    ? 'flex-row items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-full border border-gray-200'
    : 'flex-row items-center gap-2 bg-white border border-gray-200 px-4 py-2.5 rounded-xl';

  return (
    <TouchableOpacity
      className={containerClass}
      onPress={() => void handlePress()}
      activeOpacity={0.85}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <ActivityIndicator size="small" color="#374151" />
      ) : (
        <Ionicons name={icon} size={compact ? 14 : 18} color={isReady ? '#15803d' : '#374151'} />
      )}
      <Text
        className={`${compact ? 'text-xs' : 'text-sm'} font-semibold ${isReady ? 'text-green-700' : 'text-gray-700'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
