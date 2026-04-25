import React, { useState } from 'react';
import { View } from 'react-native';
import { uploadFileToR2 } from '@/features/task/services/fileUpload';
import { MediaCapture } from './MediaCapture';
import {
  AIVerificationStatus,
  type AIVerificationStatusProps,
} from './AIVerificationStatus';
import type { TaskSubmission } from '@citygame/shared';

type AiStatus = AIVerificationStatusProps['status'];

interface PhotoAITaskInputProps {
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
}

export const PhotoAITaskInput = ({
  onSubmit,
}: PhotoAITaskInputProps): React.JSX.Element => {
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleCapture = async (imageUri: string): Promise<void> => {
    setIsUploading(true);
    try {
      const outcome = await uploadFileToR2(
        imageUri,
        'image/jpeg',
        `task-photo-${Date.now()}.jpg`,
        { aiStatus, uploadProgress, setAiStatus, setUploadProgress },
      );

      if (outcome.kind === 'queued') {
        // Smuggle the media upload id through the submission so the queue
        // can wire `dependsOn` and resolve the URL once R2 receives the file.
        await onSubmit({
          imageUrl: `offline-pending://${outcome.mediaClientId}`,
          _dependsOn: outcome.mediaClientId,
        } as never);
        // aiStatus already 'queued' from uploadFileToR2 — leave it.
        return;
      }

      await onSubmit({ imageUrl: outcome.fileUrl });
      setAiStatus('idle');
      setUploadProgress(0);
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
