import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
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
 * to sync) AND only on tab screens. Positioned absolutely so it overlays
 * the tab content without pushing it down. Mounted AFTER `<Stack>` in
 * the root layout so RN paints it on top of all tab screens.
 *
 * The route check below skips the banner on Stack-presented routes
 * (`(modals)/*`, `game-ended`, `run-answers`) and on the auth flow —
 * those screens manage their own chrome and the banner would otherwise
 * paint over their CTAs (e.g. the "Wróć do gier" button on the
 * task-result modal).
 */
export const OfflineBanner = (): React.JSX.Element | null => {
  const isOnline = useIsOnline();
  const queueDepth = useMutationQueue(selectQueueDepth);
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  // Only render inside the tabs section. Modals + auth flow handle their
  // own bottom chrome.
  if (segments[0] !== '(tabs)') return null;

  // Online and nothing queued — render nothing at all. Avoids mounting an
  // empty View on every tab screen during the normal happy path.
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
