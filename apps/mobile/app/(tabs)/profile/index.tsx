import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { profileApi } from '@/services/api';
import { QUERY_KEYS } from '@/lib/constants';

const StatCard = ({
  label,
  value,
  emoji,
}: {
  label: string;
  value: string | number;
  emoji: string;
}): React.JSX.Element => (
  <Card style={styles.statCard}>
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : (
          <>
            {/* Avatar + name */}
            <Card elevated style={styles.avatarCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {displayUser?.displayName?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={styles.nameContainer}>
                <Text style={styles.displayName}>
                  {displayUser?.displayName ?? 'Gracz'}
                </Text>
                <Text style={styles.email}>
                  {displayUser?.email ?? ''}
                </Text>
              </View>
            </Card>

            {/* Stats */}
            {stats ? (
              <View>
                <Text style={styles.sectionTitle}>
                  Statystyki
                </Text>
                <View style={styles.statsRow}>
                  <StatCard
                    label="Rozegranych gier"
                    value={stats.gamesPlayed}
                    emoji="🎮"
                  />
                  <StatCard
                    label="Łączne punkty"
                    value={stats.totalPoints}
                    emoji="⭐"
                  />
                </View>
                <View style={styles.statsRow}>
                  <StatCard
                    label="Ukończonych zadań"
                    value={stats.completedTasks}
                    emoji="✅"
                  />
                  <StatCard
                    label="Globalny ranking"
                    value={`#${stats.rank}`}
                    emoji="🏆"
                  />
                </View>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <Button
                label="Wyloguj się"
                variant="outline"
                size="lg"
                fullWidth
                isLoading={isLoggingOut}
                onPress={handleLogout}
              />
            </View>

            <Text style={styles.versionText}>
              CityGame v1.0.0
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.secondary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  avatarCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: theme.fontWeight.bold,
    color: '#FFFFFF',
  },
  nameContainer: {
    alignItems: 'center',
    gap: 4,
  },
  displayName: {
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.secondary,
  },
  email: {
    fontSize: 14,
    color: theme.colors.gray[500],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gray[500],
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  statEmoji: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.secondary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: 8,
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    color: theme.colors.gray[400],
    marginTop: 8,
  },
}));
