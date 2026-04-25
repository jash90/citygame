import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '@/shared/providers/NetworkProvider';
import {
  selectQueueDepth,
  useMutationQueue,
} from '@/shared/services/mutationQueue';

/**
 * Compact top-of-screen banner. Visible only while offline (or while there
 * are queued mutations waiting to sync). Mounted once near the root so every
 * tab inherits it without each screen having to opt in.
 */
export const OfflineBanner = (): React.JSX.Element | null => {
  const isOnline = useIsOnline();
  const queueDepth = useMutationQueue(selectQueueDepth);

  if (isOnline && queueDepth === 0) return null;

  if (!isOnline) {
    return (
      <View className="bg-amber-500 px-4 py-2 flex-row items-center gap-2">
        <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
        <Text className="text-white text-xs font-semibold flex-1">
          Tryb offline
          {queueDepth > 0 ? ` — ${queueDepth} w kolejce` : ''}
        </Text>
      </View>
    );
  }

  // Online but still flushing the queue.
  return (
    <View className="bg-blue-500 px-4 py-2 flex-row items-center gap-2">
      <Ionicons name="sync-outline" size={16} color="#FFFFFF" />
      <Text className="text-white text-xs font-semibold flex-1">
        Synchronizacja: {queueDepth} {queueDepth === 1 ? 'element' : 'elementów'}
      </Text>
    </View>
  );
};
