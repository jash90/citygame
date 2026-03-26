import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useGameStore } from '@/stores/gameStore';

export default function GameSummaryScreen(): React.JSX.Element {
  const router = useRouter();
  const { totalPoints, tasksCompleted, totalTasks, timeTakenSec, rank } =
    useLocalSearchParams<{
      totalPoints: string;
      tasksCompleted: string;
      totalTasks: string;
      timeTakenSec: string;
      rank: string;
    }>();

  const { reset } = useGameStore();

  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const points = parseInt(totalPoints ?? '0', 10);
  const completed = parseInt(tasksCompleted ?? '0', 10);
  const total = parseInt(totalTasks ?? '0', 10);
  const timeSec = parseInt(timeTakenSec ?? '0', 10);
  const finalRank = parseInt(rank ?? '0', 10);

  const timeMins = Math.floor(timeSec / 60);
  const timeSecs = timeSec % 60;
  const formattedTime =
    timeSec > 0
      ? `${String(timeMins).padStart(2, '0')}:${String(timeSecs).padStart(2, '0')}`
      : null;

  const handleReturn = (): void => {
    reset();
    // Navigate back to map (tab root)
    router.replace('/(tabs)/map' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trophy animation */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          <View style={styles.trophyCircle}>
            <Text style={styles.trophyEmoji}>🏆</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[{ opacity: opacityAnim }, styles.titleContainer]}>
          <Text style={styles.title}>
            Gratulacje!
          </Text>
          <Text style={styles.subtitle}>
            Ukończyłeś grę miejską
          </Text>
        </Animated.View>

        {/* Stats grid */}
        <Animated.View
          style={[{ opacity: opacityAnim }, styles.statsCard]}
        >
          {/* Points */}
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Zdobyte punkty</Text>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsBadgeText}>{points} pkt</Text>
            </View>
          </View>

          {/* Tasks */}
          <View style={styles.statsRowBordered}>
            <Text style={styles.statsLabel}>Ukończone zadania</Text>
            <Text style={styles.statsValue}>
              {completed} / {total}
            </Text>
          </View>

          {/* Time */}
          {formattedTime ? (
            <View style={styles.statsRowBordered}>
              <Text style={styles.statsLabel}>Czas gry</Text>
              <Text style={styles.statsValue}>{formattedTime}</Text>
            </View>
          ) : null}

          {/* Rank */}
          {finalRank > 0 ? (
            <View style={styles.statsRowBordered}>
              <Text style={styles.statsLabel}>Twoje miejsce</Text>
              <Text style={styles.statsValue}>#{finalRank}</Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Bottom action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={styles.returnButton}
          onPress={handleReturn}
          activeOpacity={0.8}
        >
          <Text style={styles.returnButtonText}>Wróć do menu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyCircle: {
    width: 128,
    height: 128,
    borderRadius: 9999,
    backgroundColor: theme.colors.amber[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyEmoji: {
    fontSize: 72,
  },
  titleContainer: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
  statsCard: {
    width: '100%',
    backgroundColor: theme.colors.gray[50],
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsRowBordered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[100],
    paddingTop: 16,
  },
  statsLabel: {
    fontSize: 14,
    color: theme.colors.gray[500],
  },
  statsValue: {
    fontSize: 14,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.secondary,
  },
  pointsBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  pointsBadgeText: {
    color: '#FFFFFF',
    fontWeight: theme.fontWeight.extrabold,
    fontSize: 18,
  },
  bottomAction: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  returnButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  returnButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
  },
}));
