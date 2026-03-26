import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export interface AudioRecorderProps {
  onRecordingComplete: (audioUri: string) => void;
  maxDurationSec?: number;
}

const Waveform = ({ active }: { active: boolean }): React.JSX.Element => {
  const bars = [useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    if (!active) {
      bars.forEach((b) => Animated.spring(b, { toValue: 0.3, useNativeDriver: false }).start());
      return;
    }

    const animations = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(b, {
            toValue: 1,
            duration: 350,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(b, {
            toValue: 0.3,
            duration: 350,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <View style={waveformStyles.container}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            borderRadius: 3,
            backgroundColor: active ? '#ef4444' : '#d1d5db',
            height: b.interpolate({ inputRange: [0, 1], outputRange: [8, 36] }),
          }}
        />
      ))}
    </View>
  );
};

const waveformStyles = StyleSheet.create(() => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
  },
}));

const RecordingPulse = (): React.JSX.Element => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#fecaca',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pulseAnim }],
      }}
    >
      <View
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#ef4444' }}
      />
    </Animated.View>
  );
};

const formatDuration = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const AudioRecorder = ({
  onRecordingComplete,
  maxDurationSec = 120,
}: AudioRecorderProps): React.JSX.Element => {
  const {
    isRecording,
    duration,
    audioUri,
    hasPermission,
    isPlayingPreview,
    startRecording,
    stopRecording,
    playPreview,
    pausePreview,
    reset,
  } = useAudioRecorder(maxDurationSec);

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>🎤</Text>
        <Text style={styles.permissionTitle}>
          Dostęp do mikrofonu
        </Text>
        <Text style={styles.permissionDescription}>
          Aby nagrać odpowiedź głosową, aplikacja potrzebuje dostępu do mikrofonu.
        </Text>
      </View>
    );
  }

  if (audioUri && !isRecording) {
    return (
      <View style={styles.gap4}>
        <View style={styles.previewCard}>
          <Waveform active={false} />
          <Text style={styles.durationSmall}>
            Nagranie: {formatDuration(duration)}
          </Text>

          <TouchableOpacity
            style={styles.playbackButton}
            onPress={() => void (isPlayingPreview ? pausePreview() : playPreview())}
            activeOpacity={0.8}
          >
            <Text style={styles.playbackIcon}>{isPlayingPreview ? '⏸' : '▶️'}</Text>
            <Text style={styles.playbackLabel}>
              {isPlayingPreview ? 'Pauza' : 'Odtwórz podgląd'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeButtonText}>Nagraj ponownie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => onRecordingComplete(audioUri)}
            activeOpacity={0.8}
          >
            <Text style={styles.sendButtonText}>Wyślij nagranie</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isRecording) {
    const remaining = maxDurationSec - duration;
    return (
      <View style={styles.recordingContainer}>
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingLabel}>NAGRYWANIE</Text>
        </View>

        <Waveform active />

        <Text style={styles.durationLarge}>
          {formatDuration(duration)}
        </Text>
        <Text style={styles.remainingText}>
          Pozostało: {formatDuration(remaining)}
        </Text>

        <RecordingPulse />

        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => void stopRecording()}
          activeOpacity={0.8}
        >
          <Text style={styles.stopButtonText}>Zatrzymaj</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.idleContainer}>
      <Waveform active={false} />
      <Text style={styles.idleText}>
        Naciśnij, aby rozpocząć nagrywanie (maks. {maxDurationSec}s)
      </Text>

      <TouchableOpacity
        style={styles.recordButton}
        onPress={() => void startRecording()}
        activeOpacity={0.8}
      >
        <View style={styles.recordButtonInner} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  gap4: {
    gap: 16,
  },
  permissionContainer: {
    gap: 16,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  permissionIcon: {
    fontSize: 48,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.gray[900],
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 14,
    color: theme.colors.gray[500],
    textAlign: 'center',
    lineHeight: 14 * 1.75,
  },
  previewCard: {
    backgroundColor: theme.colors.gray[50],
    borderRadius: 16,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  durationSmall: {
    fontSize: 14,
    color: theme.colors.gray[500],
  },
  playbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  playbackIcon: {
    fontSize: 18,
  },
  playbackLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray[700],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: theme.colors.gray[700],
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  recordingContainer: {
    gap: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.red[500],
  },
  recordingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.red[600],
  },
  durationLarge: {
    fontSize: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: theme.colors.gray[900],
  },
  remainingText: {
    fontSize: 12,
    color: theme.colors.gray[400],
  },
  stopButton: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: theme.colors.red[400],
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stopButtonText: {
    color: theme.colors.red[600],
    fontWeight: '700',
  },
  idleContainer: {
    gap: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  idleText: {
    fontSize: 14,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  recordButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ef4444',
  },
}));
