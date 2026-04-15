import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/shared/lib/theme';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/map" />;
  }

  return <Redirect href="/(auth)/login" />;
}
