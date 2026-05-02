import '../src/global.css';
import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryProvider } from '@/shared/providers/QueryProvider';
import { AuthProvider } from '@/shared/providers/AuthProvider';
import { WebSocketProvider } from '@/shared/providers/WebSocketProvider';
import { NetworkProvider } from '@/shared/providers/NetworkProvider';
import { SyncOnConnect } from '@/features/offline/components/SyncOnConnect';
import { BundleFreshnessGuard } from '@/features/offline/components/BundleFreshnessGuard';
import { OfflineBanner } from '@/shared/components/OfflineBanner';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

export default function RootLayout(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
        <NetworkProvider>
        <QueryProvider>
          <WebSocketProvider>
            <AuthProvider>
              <SyncOnConnect />
              <BundleFreshnessGuard />
              <View style={{ flex: 1 }}>
                <SafeAreaView edges={['top']}>
                  <OfflineBanner />
                </SafeAreaView>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="(modals)/qr-scanner"
                    options={{ presentation: 'fullScreenModal' }}
                  />
                  <Stack.Screen
                    name="(modals)/task-result"
                    options={{
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen
                    name="game-ended"
                    options={{
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen name="run-answers" />
                </Stack>
              </View>
              <StatusBar style="dark" />
            </AuthProvider>
          </WebSocketProvider>
        </QueryProvider>
        </NetworkProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
