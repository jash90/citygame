import React, { useEffect, useRef, type ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useGameStore } from '@/features/game/stores/gameStore';
import { apiClient, NetworkError } from '@/shared/services/apiClient';
import { playerApi } from '@/features/game/services/player.api';
import { gamesApi } from '@/features/game/services/games.api';
import { colors } from '@/shared/lib/theme';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeNotificationSubscription,
} from '@/shared/services/notifications';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): React.JSX.Element => {
  const { isAuthenticated, isLoading, init, logout } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      logout();
    });
    init();
  }, [init, logout]);

  // Auth-based navigation guard
  useEffect(() => {
    if (isLoading) return;
    if (!navigationState?.key) return; // navigation not ready

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      routerRef.current.replace('/(auth)/login' as never);
    } else if (isAuthenticated && inAuthGroup) {
      routerRef.current.replace('/(tabs)' as never);
    }
  }, [isAuthenticated, isLoading, segments, navigationState?.key]);

  // Restore active game session on login
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const restore = async () => {
      try {
        const activeSession = await playerApi.activeSession();
        if (!activeSession) return;

        const game = await gamesApi.get(activeSession.gameId);
        const progress = await gamesApi.progress(activeSession.gameId);

        useGameStore.getState().restoreSession(
          game,
          progress.session,
          game.tasks ?? [],
          progress,
        );
      } catch (err) {
        // Network failures must not wipe persisted offline state. The
        // gameStore's persisted slice (currentGame/session/tasks/progress)
        // already drives the UI; we leave it untouched and let the sync
        // layer reconcile when connectivity returns.
        if (err instanceof NetworkError) return;
        // Other errors: non-critical — user can manually rejoin from game list
      }
    };

    void restore();
  }, [isAuthenticated, isLoading]);

  // Register push token once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    void registerForPushNotifications().then((token) => {
      if (!token) return;
      void apiClient.put('/auth/push-token', { pushToken: token }).catch(() => {
        // Non-critical — app works fine without push registration
      });
    });
  }, [isAuthenticated]);

  // Listen for notification taps to navigate to the relevant screen
  useEffect(() => {
    if (!isAuthenticated) return;

    const receivedSub = addNotificationReceivedListener((_notification) => {
      // Foreground notification received — handler in notifications.ts already shows it
    });

    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;

      // Navigate based on notification payload
      if (data?.taskId && typeof data.taskId === 'string') {
        routerRef.current.push({
          pathname: '/(tabs)/tasks/[taskId]' as never,
          params: { taskId: data.taskId },
        });
      } else if (data?.screen && typeof data.screen === 'string') {
        routerRef.current.push(data.screen as never);
      }
    });

    return () => {
      removeNotificationSubscription(receivedSub);
      removeNotificationSubscription(responseSub);
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
};
