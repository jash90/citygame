import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextTaskInput } from './TextTaskInput';
import { QRTaskInput } from './QRTaskInput';
import { GPSTaskInput } from './GPSTaskInput';
import { PhotoAITaskInput } from './PhotoAITaskInput';
import { AudioAITaskInput } from './AudioAITaskInput';
import { AudioTaskInput } from './AudioTaskInput';
import { PhotoTaskInput } from './PhotoTaskInput';
import { VideoTaskInput } from './VideoTaskInput';
import { PracticalTaskInput } from './PracticalTaskInput';
import type { Task } from '@/shared/types/api.types';
import type { TaskSubmission } from '@citygame/shared';

interface TaskRendererProps {
  task: Task;
  onSubmit: (submission: TaskSubmission) => void | Promise<void>;
  isSubmitting?: boolean;
}

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

  const isSelfSubmitting =
    task.type === 'PHOTO_AI' ||
    task.type === 'AUDIO_AI' ||
    task.type === 'AUDIO' ||
    task.type === 'PHOTO' ||
    task.type === 'VIDEO' ||
    task.type === 'PRACTICAL';
  const isCompleted = task.status === 'completed';
  const isPendingMentorReview = task.status === 'pending_review';

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

      {task.type === 'AUDIO' && (
        <AudioTaskInput onSubmit={onSubmit} />
      )}

      {task.type === 'PHOTO' && (
        <PhotoTaskInput onSubmit={onSubmit} />
      )}

      {task.type === 'VIDEO' && (
        <VideoTaskInput onSubmit={onSubmit} />
      )}

      {task.type === 'PRACTICAL' && (
        <PracticalTaskInput
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          isPendingReview={isPendingMentorReview}
        />
      )}

      {!isSelfSubmitting && (
        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${isCompleted ? 'bg-green-600 opacity-50' : `bg-primary ${isSubmitting || !readyPayload ? 'opacity-50' : ''}`}`}
          onPress={handleSubmit}
          disabled={isSubmitting || !readyPayload || isCompleted}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : isCompleted ? (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white text-base font-bold">Approved</Text>
            </View>
          ) : (
            <Text className="text-white text-base font-bold">Wyślij odpowiedź</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};
