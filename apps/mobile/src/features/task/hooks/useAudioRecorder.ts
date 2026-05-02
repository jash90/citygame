import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder as useExpoAudioRecorder,
} from 'expo-audio';

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
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const player = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(player);
  const isPlayingPreview = playerStatus.playing;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    requestRecordingPermissionsAsync()
      .then(({ granted }) => setHasPermission(granted))
      .catch(() => setHasPermission(false));
  }, []);

  // Cleanup on unmount — recorder/player are auto-released by their hooks
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (!hasPermission || isRecording) return;

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
    setDuration(0);
    setAudioUri(null);

    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1;
        if (next >= maxDurationSec) {
          // Auto-stop at max duration (async — fire and forget in interval)
          void recorder.stop().then(() => {
            setAudioUri(recorder.uri);
          });
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return next;
      });
    }, 1000);
  }, [hasPermission, isRecording, maxDurationSec, recorder]);

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await recorder.stop();
    setIsRecording(false);
    setAudioUri(recorder.uri);

    await setAudioModeAsync({ allowsRecording: false });
  }, [isRecording, recorder]);

  const playPreview = useCallback(async (): Promise<void> => {
    if (!audioUri) return;
    if (playerStatus.didJustFinish || player.currentTime >= player.duration) {
      await player.seekTo(0);
    }
    player.play();
  }, [audioUri, player, playerStatus.didJustFinish]);

  const pausePreview = useCallback(async (): Promise<void> => {
    player.pause();
  }, [player]);

  const reset = useCallback((): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isRecording) void recorder.stop();
    player.pause();
    setIsRecording(false);
    setDuration(0);
    setAudioUri(null);
  }, [isRecording, player, recorder]);

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
