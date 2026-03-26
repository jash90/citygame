import React, { useEffect, type ReactNode } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api';
import { colors } from '@/lib/theme';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeNotificationSubscription,
} from '@/services/notifications';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): React.JSX.Element => {
  const { isAuthenticated, isLoading, init, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      logout();
    });
    init();
  }, [init, logout]);

  // Register push token once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    void registerForPushNotifications().then((token) => {
      if (!token) return;
      // Send to backend so server can address this device
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
        router.push({
          pathname: '/(tabs)/tasks/[taskId]' as never,
          params: { taskId: data.taskId },
        });
      } else if (data?.screen && typeof data.screen === 'string') {
        router.push(data.screen as never);
      }
    });

    return () => {
      removeNotificationSubscription(receivedSub);
      removeNotificationSubscription(responseSub);
    };
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
};

const styles = StyleSheet.create((theme) => ({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
}));
