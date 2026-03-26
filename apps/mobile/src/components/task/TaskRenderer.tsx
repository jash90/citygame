import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/stores/gameStore';
import { storageApi } from '@/services/api';
import { withAlpha } from '@/lib/unistyles';
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
    <View style={styles.gap3}>
      <Text style={styles.label}>Twoja odpowiedź:</Text>
      <TextInput
        style={styles.textInput}
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
    <View style={styles.gap3}>
      <TouchableOpacity
        style={styles.scanButton(!!scanned)}
        onPress={handleScan}
        activeOpacity={0.7}
      >
        <Text style={styles.scanIcon}>{scanned ? '✅' : '◻️'}</Text>
        <Text style={styles.scanLabel}>
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

  const handleCheck = (): void => {
    const lat = task.location?.lat ?? 0;
    const lng = task.location?.lng ?? 0;
    setVerified(true);
    onReady({ latitude: lat, longitude: lng });
  };

  return (
    <View style={styles.gap3}>
      {task.location ? (
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>Cel:</Text>
          <Text style={styles.locationCoords}>
            {task.location.lat.toFixed(5)}, {task.location.lng.toFixed(5)}
          </Text>
          <Text style={styles.locationRadius}>
            Promień: {task.location.radiusMeters} m
          </Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={styles.scanButton(verified)}
        onPress={handleCheck}
        activeOpacity={0.7}
      >
        <Text style={styles.scanIcon}>{verified ? '✅' : '📍'}</Text>
        <Text style={styles.scanLabel}>
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
    <View style={styles.gap4}>
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
    <View style={styles.gap4}>
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
  const [textAiStatus, setTextAiStatus] = useState<AiStatus>('idle');

  const isAiType =
    task.type === 'PHOTO_AI' || task.type === 'AUDIO_AI' || task.type === 'TEXT_AI';
  const isTextType =
    task.type === 'TEXT_EXACT' ||
    task.type === 'TEXT_AI' ||
    task.type === 'CIPHER' ||
    task.type === 'MIXED';

  const handleSubmit = (): void => {
    if (!readyPayload) return;
    if (task.type === 'TEXT_AI') setTextAiStatus('processing');
    onSubmit(readyPayload);
  };

  const isSelfSubmitting = task.type === 'PHOTO_AI' || task.type === 'AUDIO_AI';

  return (
    <View style={styles.gap4}>
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

      {task.type === 'TEXT_AI' && isAiType && (
        <AIVerificationStatus status={textAiStatus} />
      )}

      {!isSelfSubmitting && (
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || !readyPayload) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || !readyPayload}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.submitText}>Wyślij odpowiedź</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  gap3: {
    gap: 12,
  },
  gap4: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.gray[700],
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: theme.colors.gray[900],
    minHeight: 100,
  },
  scanButton: (active: boolean) => ({
    borderWidth: 2,
    borderStyle: 'dashed' as const,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center' as const,
    gap: 12,
    borderColor: active ? theme.colors.success : withAlpha(theme.colors.primary, 0.4),
    backgroundColor: active ? theme.colors.green[50] : withAlpha(theme.colors.primary, 0.05),
  }),
  scanIcon: {
    fontSize: 36,
  },
  scanLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.gray[600],
  },
  locationInfo: {
    backgroundColor: theme.colors.gray[50],
    borderRadius: 12,
    padding: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: theme.colors.gray[500],
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.gray[700],
  },
  locationRadius: {
    fontSize: 12,
    color: theme.colors.gray[500],
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
}));
