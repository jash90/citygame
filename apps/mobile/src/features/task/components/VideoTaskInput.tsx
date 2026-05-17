import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useCamera } from '@/features/task/hooks/useCamera';
import { uploadFileToR2 } from '@/features/task/services/fileUpload';
import {
  AIVerificationStatus,
  type AIVerificationStatusProps,
} from './AIVerificationStatus';
import type { TaskSubmission } from '@citygame/shared';

type Status = AIVerificationStatusProps['status'];

interface VideoTaskInputProps {
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
  /** Hard cap on recording duration in seconds (default 60). */
  maxDurationSec?: number;
}

/**
 * Video capture without AI scoring — player records short MP4, file uploads,
 * task is auto-accepted by the backend (see `video.strategy.ts`).
 */
export const VideoTaskInput = ({
  onSubmit,
  maxDurationSec = 60,
}: VideoTaskInputProps): React.JSX.Element => {
  const { hasPermission, isLoading, requestPermission, facing, toggleFacing } =
    useCamera();
  const cameraRef = useRef<CameraView>(null);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View className="gap-4 items-center py-6 px-4">
        <Ionicons name="videocam-outline" size={48} color="#9CA3AF" />
        <Text className="text-base font-semibold text-gray-900 text-center">
          Dostęp do kamery
        </Text>
        <TouchableOpacity
          onPress={() => void requestPermission()}
          className="bg-primary rounded-xl px-5 py-3"
        >
          <Text className="text-white font-semibold">Zezwól</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleRecord = async (): Promise<void> => {
    if (!cameraRef.current) return;
    if (recording) {
      cameraRef.current.stopRecording();
      return;
    }
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: maxDurationSec,
      } as never);
      if (!result?.uri) {
        setRecording(false);
        return;
      }
      const outcome = await uploadFileToR2(
        result.uri,
        'video/mp4',
        `task-video-${Date.now()}.mp4`,
        { aiStatus: status, uploadProgress: progress, setAiStatus: setStatus, setUploadProgress: setProgress },
      );

      if (outcome.kind === 'queued') {
        await onSubmit({
          videoUrl: `offline-pending://${outcome.mediaClientId}`,
          _dependsOn: outcome.mediaClientId,
        } as never);
      } else {
        await onSubmit({ videoUrl: outcome.fileUrl });
        setStatus('idle');
        setProgress(0);
      }
    } catch {
      setStatus('error');
    } finally {
      setRecording(false);
    }
  };

  return (
    <View className="gap-3">
      {status === 'idle' || status === 'error' ? (
        <View className="rounded-xl overflow-hidden bg-black" style={{ height: 360 }}>
          <CameraView
            ref={cameraRef}
            mode="video"
            facing={facing}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      {status === 'idle' || status === 'error' ? (
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => void handleRecord()}
            activeOpacity={0.8}
            className={`flex-1 rounded-xl py-3 items-center ${recording ? 'bg-red-600' : 'bg-primary'}`}
          >
            <Text className="text-white font-bold">
              {recording ? 'Stop' : `Nagraj (max ${maxDurationSec}s)`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleFacing}
            className="bg-gray-200 rounded-xl px-4 items-center justify-center"
          >
            <Ionicons name="camera-reverse-outline" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
      ) : null}
      <AIVerificationStatus
        status={status}
        progress={progress}
        onRetry={() => {
          setStatus('idle');
          setProgress(0);
        }}
      />
    </View>
  );
};
