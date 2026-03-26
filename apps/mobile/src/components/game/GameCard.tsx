import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/lib/unistyles';
import type { Game } from '@/services/api';

interface GameCardProps {
  game: Game;
  onJoin: (game: Game) => void;
  isJoining?: boolean;
}

export const GameCard = ({ game, onJoin, isJoining = false }: GameCardProps): React.JSX.Element => {
  return (
    <View style={styles.card}>
      {game.coverImageUrl ? (
        <Image
          source={{ uri: game.coverImageUrl }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="map-outline" size={48} color="#FF6B35" />
        </View>
      )}
      <View style={styles.content}>
        <View>
          <Text style={styles.title} numberOfLines={1}>
            {game.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.city}>{game.city}</Text>
          </View>
        </View>
        {game.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {game.description}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="list-outline" size={14} color="#6B7280" />
              <Text style={styles.statText}>{game.taskCount} zadań</Text>
            </View>
            {game.duration ? (
              <View style={styles.statItem}>
                <Ionicons name="timer-outline" size={14} color="#6B7280" />
                <Text style={styles.statText}>~{game.duration} min</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.joinButton(isJoining)}
            onPress={() => onJoin(game)}
            disabled={isJoining}
            activeOpacity={0.8}
          >
            <Text style={styles.joinButtonText}>
              {isJoining ? 'Dołączanie...' : 'Dołącz'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray[100],
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  coverImage: {
    width: '100%',
    height: 160,
  },
  coverPlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: withAlpha(theme.colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 48,
  },
  content: {
    padding: theme.spacing.md,
    gap: 12,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.secondary,
  },
  city: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[500],
    marginTop: 2,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600],
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[500],
  },
  joinButton: (isJoining: boolean) => ({
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 20,
    paddingVertical: 10,
    opacity: isJoining ? 0.5 : 1,
  }),
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
  },
}));
