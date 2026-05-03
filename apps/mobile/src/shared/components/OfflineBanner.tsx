import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '@/shared/providers/NetworkProvider';
import {
  selectQueueDepth,
  useMutationQueue,
} from '@/shared/services/mutationQueue';

// Must match `tabBarStyle.height` in apps/mobile/app/(tabs)/_layout.tsx.
// We add `insets.bottom` because Expo Router stacks the home-indicator
// safe-area below the tab bar's content height.
const TAB_BAR_HEIGHT = 80;

/**
 * Compact bottom-of-screen banner sitting just above the tab bar.
 * Visible only while offline (or while there are queued mutations waiting
 * to sync). Positioned absolutely so it overlays the screen content
 * without pushing it down. Mounted AFTER `<Stack>` in the root layout so
 * RN paints it on top of all screens (including the tab bar).
 */
export const OfflineBanner = (): React.JSX.Element | null => {
  const isOnline = useIsOnline();
  const queueDepth = useMutationQueue(selectQueueDepth);
  const insets = useSafeAreaInsets();

  // Online and nothing queued — render nothing at all. Avoids mounting an
  // empty View on every screen during the normal happy path.
  if (isOnline && queueDepth === 0) return null;

  const bottom = insets.bottom + TAB_BAR_HEIGHT - 35;

  return (
    <View
      className={`absolute left-0 right-0`}
      style={{ bottom: bottom }}
      pointerEvents="box-none"
    >
      {!isOnline ? (
        <View
          className="bg-amber-500 px-4 py-2 flex-row items-center gap-2"
          pointerEvents="auto"
        >
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text className="text-white text-xs font-semibold flex-1">
            Tryb offline
            {queueDepth > 0 ? ` — ${queueDepth} w kolejce` : ''}
          </Text>
        </View>
      ) : null}
      {queueDepth > 0 ? (
        <View
          className="bg-blue-500 px-4 py-2 flex-row items-center gap-2"
          pointerEvents="auto"
        >
          <Ionicons name="sync-outline" size={16} color="#FFFFFF" />
          <Text className="text-white text-xs font-semibold flex-1">
            Synchronizacja: {queueDepth} {queueDepth === 1 ? 'element' : 'elementów'}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
