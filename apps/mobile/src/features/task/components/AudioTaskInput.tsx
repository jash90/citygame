import React, { useState } from 'react';
import { View } from 'react-native';
import { uploadFileToR2 } from '@/features/task/services/fileUpload';
import { AudioRecorder } from './AudioRecorder';
import {
  AIVerificationStatus,
  type AIVerificationStatusProps,
} from './AIVerificationStatus';
import type { TaskSubmission } from '@citygame/shared';

type Status = AIVerificationStatusProps['status'];

interface AudioTaskInputProps {
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
}

/**
 * Audio capture without AI scoring — player records, file uploads, task is
 * auto-accepted by the backend (see `audio.strategy.ts`).
 */
export const AudioTaskInput = ({
  onSubmit,
}: AudioTaskInputProps): React.JSX.Element => {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);

  const handleRecordingComplete = async (audioUri: string): Promise<void> => {
    try {
      const outcome = await uploadFileToR2(
        audioUri,
        'audio/m4a',
        `task-audio-${Date.now()}.m4a`,
        { aiStatus: status, uploadProgress: progress, setAiStatus: setStatus, setUploadProgress: setProgress },
      );

      if (outcome.kind === 'queued') {
        await onSubmit({
          audioUrl: `offline-pending://${outcome.mediaClientId}`,
          _dependsOn: outcome.mediaClientId,
        } as never);
        return;
      }

      await onSubmit({ audioUrl: outcome.fileUrl });
      setStatus('idle');
      setProgress(0);
    } catch {
      setStatus('error');
    }
  };

  const handleRetry = (): void => {
    setStatus('idle');
    setProgress(0);
  };

  return (
    <View className="gap-4">
      {status === 'idle' || status === 'error' ? (
        <AudioRecorder
          onRecordingComplete={(uri) => void handleRecordingComplete(uri)}
          maxDurationSec={120}
        />
      ) : null}
      <AIVerificationStatus status={status} progress={progress} onRetry={handleRetry} />
    </View>
  );
};
