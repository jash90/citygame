import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { profileApi } from '@/services/api';
import { QUERY_KEYS } from '@/lib/constants';
import { StyledSafeAreaView } from '@/lib/styled';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];


const StatCard = ({
  label,
  value,
  icon,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: IoniconsName;
  iconColor: string;
}): React.JSX.Element => (
  <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 }}>
    <Ionicons name={icon} size={24} color={iconColor} />
    <Text className="text-xl font-extrabold text-secondary">{value}</Text>
    <Text className="text-xs text-gray-500 text-center">{label}</Text>
  </Card>
);

export default function ProfileScreen(): React.JSX.Element {
  const { user } = useAuthStore();
  const { logout, isLoading: isLoggingOut } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: QUERY_KEYS.PROFILE,
    queryFn: () => profileApi.get(),
  });

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
  const stats = profile?.stats;

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

            {/* Stats */}
            {stats ? (
              <View>
                <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-widest">
                  Statystyki
                </Text>
                <View className="flex-row gap-3 mb-3">
                  <StatCard
                    label="Rozegranych gier"
                    value={stats.gamesPlayed}
                    icon="game-controller"
                    iconColor="#6366F1"
                  />
                  <StatCard
                    label="Łączne punkty"
                    value={stats.totalPoints}
                    icon="star"
                    iconColor="#F59E0B"
                  />
                </View>
                <View className="flex-row gap-3 mb-3">
                  <StatCard
                    label="Ukończonych zadań"
                    value={stats.completedTasks}
                    icon="checkmark-circle"
                    iconColor="#22C55E"
                  />
                  <StatCard
                    label="Globalny ranking"
                    value={`#${stats.rank}`}
                    icon="trophy"
                    iconColor="#FF6B35"
                  />
                </View>
              </View>
            ) : null}

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
