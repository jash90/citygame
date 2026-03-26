import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  duration: number; // seconds elapsed
  audioUri: string | null;
  hasPermission: boolean;
  isPlayingPreview: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playPreview: () => Promise<void>;
  pausePreview: () => Promise<void>;
  reset: () => void;
}

export function useAudioRecorder(maxDurationSec = 120): UseAudioRecorderReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Audio.requestPermissionsAsync()
      .then(({ granted }) => setHasPermission(granted))
      .catch(() => setHasPermission(false));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      void soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (!hasPermission || isRecording) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    recordingRef.current = recording;
    setIsRecording(true);
    setDuration(0);
    setAudioUri(null);

    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1;
        if (next >= maxDurationSec) {
          // Auto-stop at max duration (async — fire and forget in interval)
          void recording.stopAndUnloadAsync().then((status) => {
            if (status.uri) setAudioUri(status.uri);
          });
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return next;
      });
    }, 1000);
  }, [hasPermission, isRecording, maxDurationSec]);

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current || !isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;
    setIsRecording(false);
    if (uri) setAudioUri(uri);

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  }, [isRecording]);

  const playPreview = useCallback(async (): Promise<void> => {
    if (!audioUri) return;

    // Unload previous playback if any
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: true },
    );
    soundRef.current = sound;
    setIsPlayingPreview(true);

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        setIsPlayingPreview(false);
      }
    });
  }, [audioUri]);

  const pausePreview = useCallback(async (): Promise<void> => {
    if (!soundRef.current) return;
    await soundRef.current.pauseAsync();
    setIsPlayingPreview(false);
  }, []);

  const reset = useCallback((): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    void soundRef.current?.unloadAsync().catch(() => undefined);
    recordingRef.current = null;
    soundRef.current = null;
    setIsRecording(false);
    setDuration(0);
    setAudioUri(null);
    setIsPlayingPreview(false);
  }, []);

  return {
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
  };
}
