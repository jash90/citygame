import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 }}>
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
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#fecaca', alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pulseAnim }],
      }}
    >
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#ef4444' }} />
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
    isRecording, duration, audioUri, hasPermission,
    isPlayingPreview, startRecording, stopRecording,
    playPreview, pausePreview, reset,
  } = useAudioRecorder(maxDurationSec);

  if (!hasPermission) {
    return (
      <View className="gap-4 items-center py-6 px-4">
        <Ionicons name="mic-outline" size={48} color="#9CA3AF" />
        <Text className="text-base font-semibold text-gray-900 text-center">
          Dostęp do mikrofonu
        </Text>
        <Text className="text-sm text-gray-500 text-center leading-6">
          Aby nagrać odpowiedź głosową, aplikacja potrzebuje dostępu do mikrofonu.
        </Text>
      </View>
    );
  }

  if (audioUri && !isRecording) {
    return (
      <View className="gap-4">
        <View className="bg-gray-50 rounded-2xl p-4 gap-3 items-center">
          <Waveform active={false} />
          <Text className="text-sm text-gray-500">
            Nagranie: {formatDuration(duration)}
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2.5"
            onPress={() => void (isPlayingPreview ? pausePreview() : playPreview())}
            activeOpacity={0.8}
          >
            <Ionicons name={isPlayingPreview ? 'pause' : 'play'} size={18} color="#374151" />
            <Text className="text-sm font-semibold text-gray-700">
              {isPlayingPreview ? 'Pauza' : 'Odtwórz podgląd'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 border border-gray-200 rounded-xl py-3.5 items-center"
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text className="text-gray-700 font-semibold">Nagraj ponownie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-primary rounded-xl py-3.5 items-center"
            onPress={() => onRecordingComplete(audioUri)}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold">Wyślij nagranie</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isRecording) {
    const remaining = maxDurationSec - duration;
    return (
      <View className="gap-4 items-center py-4">
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
          <Text className="text-sm font-semibold text-red-600">NAGRYWANIE</Text>
        </View>

        <Waveform active />

        <Text className="text-3xl font-bold text-gray-900" style={{ fontVariant: ['tabular-nums'] }}>
          {formatDuration(duration)}
        </Text>
        <Text className="text-xs text-gray-400">
          Pozostało: {formatDuration(remaining)}
        </Text>

        <RecordingPulse />

        <TouchableOpacity
          className="mt-2 border-2 border-red-400 rounded-xl px-8 py-3 items-center"
          onPress={() => void stopRecording()}
          activeOpacity={0.8}
        >
          <Text className="text-red-600 font-bold">Zatrzymaj</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="gap-4 items-center py-4">
      <Waveform active={false} />
      <Text className="text-sm text-gray-500 text-center">
        Naciśnij, aby rozpocząć nagrywanie (maks. {maxDurationSec}s)
      </Text>

      <TouchableOpacity
        style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}
        onPress={() => void startRecording()}
        activeOpacity={0.8}
      >
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#ef4444' }} />
      </TouchableOpacity>
    </View>
  );
};
