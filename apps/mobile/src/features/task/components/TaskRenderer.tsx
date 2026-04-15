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

  const isSelfSubmitting = task.type === 'PHOTO_AI' || task.type === 'AUDIO_AI';
  const isCompleted = task.status === 'completed';

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
