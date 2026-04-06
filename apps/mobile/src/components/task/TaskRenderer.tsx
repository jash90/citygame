import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/stores/gameStore';
import { useLocationStore } from '@/stores/locationStore';
import { storageApi } from '@/services/api';
import { MediaCapture } from './MediaCapture';
import { AudioRecorder } from './AudioRecorder';
import {
  AIVerificationStatus,
  type AIVerificationStatusProps,
} from './AIVerificationStatus';
import type { Task, TaskSubmission } from '@/services/api';

interface TaskRendererProps {
  task: Task;
  onSubmit: (submission: TaskSubmission) => void;
  isSubmitting?: boolean;
}

type AiStatus = AIVerificationStatusProps['status'];

const TextTaskInput = ({
  onReady,
}: {
  onReady: (answer: string) => void;
}): React.JSX.Element => {
  const [value, setValue] = useState('');
  return (
    <View className="gap-3">
      <Text className="text-sm font-medium text-gray-700">Twoja odpowiedź:</Text>
      <TextInput
        className="border border-gray-200 rounded-xl p-3 text-base text-gray-900 min-h-[100px]"
        placeholder="Wpisz odpowiedź..."
        multiline
        textAlignVertical="top"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          onReady(t);
        }}
      />
    </View>
  );
};

const QRTaskInput = ({
  onReady,
}: {
  onReady: (code: string) => void;
}): React.JSX.Element => {
  const router = useRouter();
  const { lastScannedQR, setLastScannedQR } = useGameStore();
  const [scanned, setScanned] = useState<string | null>(null);

  useEffect(() => {
    if (lastScannedQR && lastScannedQR !== scanned) {
      setScanned(lastScannedQR);
      onReady(lastScannedQR);
      setLastScannedQR(null);
    }
  }, [lastScannedQR, scanned, onReady, setLastScannedQR]);

  const handleScan = (): void => {
    void router.push('/(modals)/qr-scanner' as never);
  };

  return (
    <View className="gap-3">
      <TouchableOpacity
        className={
          scanned
            ? 'border-2 border-dashed border-success rounded-xl p-8 items-center gap-3 bg-green-50'
            : 'border-2 border-dashed border-primary/40 rounded-xl p-8 items-center gap-3 bg-primary/5'
        }
        onPress={handleScan}
        activeOpacity={0.7}
      >
        <Ionicons name={scanned ? 'checkmark-circle' : 'qr-code-outline'} size={36} color={scanned ? '#22C55E' : '#FF6B35'} />
        <Text className="text-sm font-medium text-gray-600">
          {scanned ? `Zeskanowano: ${scanned}` : 'Dotknij, aby zeskanować kod QR'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const GPSTaskInput = ({
  task,
  onReady,
}: {
  task: Task;
  onReady: (coords: { latitude: number; longitude: number }) => void;
}): React.JSX.Element => {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerLocation = useLocationStore((s) => s.location);

  const handleCheck = (): void => {
    if (!playerLocation) {
      setError('Brak sygnału GPS. Upewnij się, że lokalizacja jest włączona.');
      return;
    }
    setError(null);
    setVerified(true);
    onReady({ latitude: playerLocation.lat, longitude: playerLocation.lng });
  };

  return (
    <View className="gap-3">
      {task.location ? (
        <View className="bg-gray-50 rounded-xl p-3">
          <Text className="text-xs text-gray-500 mb-1">Cel:</Text>
          <Text className="text-sm font-medium text-gray-700">
            {task.location.lat.toFixed(5)}, {task.location.lng.toFixed(5)}
          </Text>
          <Text className="text-xs text-gray-500 mt-1">
            Promień: {task.location.radiusMeters} m
          </Text>
        </View>
      ) : null}
      {error ? (
        <View className="bg-red-50 rounded-xl p-3">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        className={
          verified
            ? 'border-2 border-dashed border-success rounded-xl p-8 items-center gap-3 bg-green-50'
            : 'border-2 border-dashed border-primary/40 rounded-xl p-8 items-center gap-3 bg-primary/5'
        }
        onPress={handleCheck}
        activeOpacity={0.7}
      >
        <Ionicons name={verified ? 'checkmark-circle' : 'location'} size={36} color={verified ? '#22C55E' : '#FF6B35'} />
        <Text className="text-sm font-medium text-gray-600">
          {verified
            ? 'Lokalizacja zweryfikowana!'
            : 'Dotknij, aby sprawdzić lokalizację GPS'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

interface UploadState {
  aiStatus: AiStatus;
  uploadProgress: number;
  setAiStatus: (s: AiStatus) => void;
  setUploadProgress: (p: number) => void;
}

async function uploadFileToR2(
  uri: string,
  contentType: string,
  filename: string,
  uploadState: UploadState,
): Promise<string> {
  const { setAiStatus, setUploadProgress } = uploadState;
  setAiStatus('uploading');
  setUploadProgress(0);

  const { uploadUrl, fileUrl } = await storageApi.presign(contentType, filename);

  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();

  setUploadProgress(40);

  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });

  setUploadProgress(100);
  setAiStatus('processing');
  return fileUrl;
}

const PhotoAITaskInput = ({
  onSubmit,
}: {
  onSubmit: (submission: TaskSubmission) => void;
}): React.JSX.Element => {
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleCapture = async (imageUri: string): Promise<void> => {
    setIsUploading(true);
    try {
      const fileUrl = await uploadFileToR2(
        imageUri,
        'image/jpeg',
        `task-photo-${Date.now()}.jpg`,
        { aiStatus, uploadProgress, setAiStatus, setUploadProgress },
      );
      onSubmit({ imageUrl: fileUrl });
    } catch {
      setAiStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = (): void => {
    setAiStatus('idle');
    setUploadProgress(0);
    setIsUploading(false);
  };

  return (
    <View className="gap-4">
      {aiStatus === 'idle' || aiStatus === 'error' ? (
        <MediaCapture
          onCapture={(uri) => void handleCapture(uri)}
          isUploading={isUploading}
          compact
        />
      ) : null}
      <AIVerificationStatus
        status={aiStatus}
        progress={uploadProgress}
        onRetry={handleRetry}
      />
    </View>
  );
};

const AudioAITaskInput = ({
  onSubmit,
}: {
  onSubmit: (submission: TaskSubmission) => void;
}): React.JSX.Element => {
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleRecordingComplete = async (audioUri: string): Promise<void> => {
    try {
      const fileUrl = await uploadFileToR2(
        audioUri,
        'audio/m4a',
        `task-audio-${Date.now()}.m4a`,
        { aiStatus, uploadProgress, setAiStatus, setUploadProgress },
      );
      onSubmit({ transcription: fileUrl });
    } catch {
      setAiStatus('error');
    }
  };

  const handleRetry = (): void => {
    setAiStatus('idle');
    setUploadProgress(0);
  };

  return (
    <View className="gap-4">
      {aiStatus === 'idle' || aiStatus === 'error' ? (
        <AudioRecorder
          onRecordingComplete={(uri) => void handleRecordingComplete(uri)}
          maxDurationSec={120}
        />
      ) : null}
      <AIVerificationStatus
        status={aiStatus}
        progress={uploadProgress}
        onRetry={handleRetry}
      />
    </View>
  );
};

export const TaskRenderer = ({
  task,
  onSubmit,
  isSubmitting = false,
}: TaskRendererProps): React.JSX.Element => {
  const [readyPayload, setReadyPayload] = useState<TaskSubmission | null>(null);

  const isTextType =
    task.type === 'TEXT_EXACT' ||
    task.type === 'TEXT_AI' ||
    task.type === 'CIPHER' ||
    task.type === 'MIXED';

  const handleSubmit = (): void => {
    if (!readyPayload) return;
    onSubmit(readyPayload);
  };

  const isSelfSubmitting = task.type === 'PHOTO_AI' || task.type === 'AUDIO_AI';

  return (
    <View className="gap-4">
      {isTextType && (
        <TextTaskInput onReady={(answer) => setReadyPayload({ answer })} />
      )}

      {task.type === 'PHOTO_AI' && (
        <PhotoAITaskInput onSubmit={onSubmit} />
      )}

      {task.type === 'QR_SCAN' && (
        <QRTaskInput onReady={(scannedCode) => setReadyPayload({ scannedCode })} />
      )}

      {task.type === 'GPS_REACH' && (
        <GPSTaskInput
          task={task}
          onReady={(coords) =>
            setReadyPayload({ latitude: coords.latitude, longitude: coords.longitude })
          }
        />
      )}

      {task.type === 'AUDIO_AI' && (
        <AudioAITaskInput onSubmit={onSubmit} />
      )}

      {!isSelfSubmitting && (
        <TouchableOpacity
          className={`bg-primary rounded-xl py-4 items-center ${isSubmitting || !readyPayload ? 'opacity-50' : ''}`}
          onPress={handleSubmit}
          disabled={isSubmitting || !readyPayload}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white text-base font-bold">Wyślij odpowiedź</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};
