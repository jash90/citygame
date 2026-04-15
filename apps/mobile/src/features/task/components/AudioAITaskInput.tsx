import React, { useState } from 'react';
import { View } from 'react-native';
import { uploadFileToR2 } from '@/features/task/services/fileUpload';
import { AudioRecorder } from './AudioRecorder';
import {
  AIVerificationStatus,
  type AIVerificationStatusProps,
} from './AIVerificationStatus';
import type { TaskSubmission } from '@citygame/shared';

type AiStatus = AIVerificationStatusProps['status'];

interface AudioAITaskInputProps {
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
}

export const AudioAITaskInput = ({
  onSubmit,
}: AudioAITaskInputProps): React.JSX.Element => {
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
      await onSubmit({ transcription: fileUrl });
      setAiStatus('idle');
      setUploadProgress(0);
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
