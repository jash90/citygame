import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { NetworkError } from '@/shared/components/NetworkError';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileApi } from '@/features/profile/services/profile.api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { StyledSafeAreaView } from '@/shared/lib/styled';

export default function ProfileScreen(): React.JSX.Element {
  const { user, profile: cachedProfile, setProfile } = useAuthStore();
  const { logout, isLoading: isLoggingOut } = useAuth();

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.PROFILE,
    queryFn: () => profileApi.get(),
    staleTime: 24 * 60 * 60_000, // 24 hours — profile data doesn't change often
    initialData: cachedProfile ?? undefined,
  });

  useEffect(() => {
    if (profile && JSON.stringify(profile) !== JSON.stringify(cachedProfile)) {
      void setProfile(profile);
    }
  }, [profile, cachedProfile, setProfile]);

  const handleLogout = (): void => {
    Alert.alert(
      'Wylogowanie',
      'Czy na pewno chcesz się wylogować?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyloguj',
          style: 'destructive',
          onPress: () => void logout(),
        },
      ],
    );
  };

  const displayUser = profile ?? user;

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-3 bg-surface border-b border-gray-100">
        <Text className="text-2xl font-extrabold text-secondary">Profil</Text>
      </View>

      <ScrollView
        className="px-4 py-5"
        contentContainerStyle={{ gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : isError ? (
          <NetworkError
            message={error?.message ?? 'Nie udało się załadować profilu.'}
            onRetry={() => void refetch()}
          />
        ) : (
          <>
            {/* Avatar + name */}
            <Card elevated style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
              <View className="w-20 h-20 rounded-full bg-primary items-center justify-center">
                <Text className="text-4xl font-bold text-white">
                  {displayUser?.displayName?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
              <View className="items-center gap-1">
                <Text className="text-xl font-bold text-secondary">
                  {displayUser?.displayName ?? 'Gracz'}
                </Text>
                <Text className="text-sm text-gray-500">
                  {displayUser?.email ?? ''}
                </Text>
              </View>
            </Card>

            {/* Stats — hidden until backend /profile endpoint is implemented */}

            {/* Actions */}
            <View className="mt-2">
              <Button
                label="Wyloguj się"
                variant="outline"
                size="lg"
                fullWidth
                isLoading={isLoggingOut}
                onPress={handleLogout}
              />
            </View>

            <Text className="text-xs text-center text-gray-400 mt-2">
              CityGame v1.0.0
            </Text>
          </>
        )}
      </ScrollView>
    </StyledSafeAreaView>
  );
}
