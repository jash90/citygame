import React, { useState } from 'react';
import { View } from 'react-native';
import { uploadFileToR2 } from '@/features/task/services/fileUpload';
import { MediaCapture } from './MediaCapture';
import {
  AIVerificationStatus,
  type AIVerificationStatusProps,
} from './AIVerificationStatus';
import type { TaskSubmission } from '@citygame/shared';

type Status = AIVerificationStatusProps['status'];

interface PhotoTaskInputProps {
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
}

/**
 * Photo capture without AI scoring — player takes a photo, file uploads,
 * task is auto-accepted by the backend (see `photo.strategy.ts`).
 */
export const PhotoTaskInput = ({
  onSubmit,
}: PhotoTaskInputProps): React.JSX.Element => {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleCapture = async (imageUri: string): Promise<void> => {
    setIsUploading(true);
    try {
      const outcome = await uploadFileToR2(
        imageUri,
        'image/jpeg',
        `task-photo-${Date.now()}.jpg`,
        { aiStatus: status, uploadProgress: progress, setAiStatus: setStatus, setUploadProgress: setProgress },
      );

      if (outcome.kind === 'queued') {
        await onSubmit({
          imageUrl: `offline-pending://${outcome.mediaClientId}`,
          _dependsOn: outcome.mediaClientId,
        } as never);
        return;
      }

      await onSubmit({ imageUrl: outcome.fileUrl });
      setStatus('idle');
      setProgress(0);
    } catch {
      setStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = (): void => {
    setStatus('idle');
    setProgress(0);
    setIsUploading(false);
  };

  return (
    <View className="gap-4">
      {status === 'idle' || status === 'error' ? (
        <MediaCapture
          onCapture={(uri) => void handleCapture(uri)}
          isUploading={isUploading}
          compact
        />
      ) : null}
      <AIVerificationStatus status={status} progress={progress} onRetry={handleRetry} />
    </View>
  );
};
