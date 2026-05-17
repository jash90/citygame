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

  // Hard-coded list of task types this build of the app knows how to render.
  // If the backend later adds new types, an old client lands on the
  // "unsupported" fallback rather than showing a useless submit button.
  const KNOWN_TASK_TYPES = new Set<Task['type']>([
    'TEXT_EXACT',
    'TEXT_AI',
    'CIPHER',
    'MIXED',
    'PHOTO_AI',
    'AUDIO_AI',
    'QR_SCAN',
    'GPS_REACH',
    'AUDIO',
    'PHOTO',
    'VIDEO',
    'PRACTICAL',
  ]);
  const isUnknownType = !KNOWN_TASK_TYPES.has(task.type);

  const isSelfSubmitting =
    task.type === 'PHOTO_AI' ||
    task.type === 'AUDIO_AI' ||
    task.type === 'AUDIO' ||
    task.type === 'PHOTO' ||
    task.type === 'VIDEO' ||
    task.type === 'PRACTICAL' ||
    isUnknownType;
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
        <AudioTaskInput
          audioUrl={task.verifyConfig?.audioUrl as string | undefined}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {task.type === 'PHOTO' && (
        <PhotoTaskInput
          imageUrl={task.verifyConfig?.imageUrl as string | undefined}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {task.type === 'VIDEO' && (
        <VideoTaskInput
          videoUrl={task.verifyConfig?.videoUrl as string | undefined}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {task.type === 'PRACTICAL' && (
        <PracticalTaskInput
          criteria={task.verifyConfig?.criteria as string | undefined}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          isPendingReview={isPendingMentorReview}
        />
      )}

      {isUnknownType && (
        <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle-outline" size={20} color="#b45309" />
            <Text className="text-base font-semibold text-amber-900">
              Nowy typ zadania
            </Text>
          </View>
          <Text className="text-sm text-amber-800 leading-5">
            To zadanie wymaga nowszej wersji aplikacji. Zaktualizuj CityGame w
            sklepie, aby móc je wykonać.
          </Text>
        </View>
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
