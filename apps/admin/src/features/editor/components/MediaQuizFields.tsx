'use client';

import type {
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
} from 'react-hook-form';
import { TaskType } from '@citygame/shared';
import { AIVerifySection } from './AIVerifySection';
import { Field, inputClass, type TaskFormValues } from './taskEditor.utils';

interface MediaQuizFieldsProps {
  selectedType: TaskType.AUDIO | TaskType.PHOTO | TaskType.VIDEO;
  register: UseFormRegister<TaskFormValues>;
  watch: UseFormWatch<TaskFormValues>;
  setValue: UseFormSetValue<TaskFormValues>;
  currentTitle: string;
  currentDescription: string;
  aiPrompt: string;
  aiThreshold: number;
  task: { verifyConfig?: unknown } | null;
}

const MEDIA_LABELS: Record<MediaQuizFieldsProps['selectedType'], {
  urlLabel: string;
  urlHint: string;
  urlPlaceholder: string;
  preview: 'audio' | 'image' | 'video';
}> = {
  [TaskType.AUDIO]: {
    urlLabel: 'URL pliku audio',
    urlHint:
      'Link do nagrania (mp3 / m4a / wav) wgranego do storage. Gracz odsłucha klip i wpisze odpowiedź.',
    urlPlaceholder: 'https://…/clip.m4a',
    preview: 'audio',
  },
  [TaskType.PHOTO]: {
    urlLabel: 'URL zdjęcia',
    urlHint:
      'Link do obrazu (jpg / png / webp). Gracz zobaczy zdjęcie i wpisze odpowiedź.',
    urlPlaceholder: 'https://…/photo.jpg',
    preview: 'image',
  },
  [TaskType.VIDEO]: {
    urlLabel: 'URL pliku wideo',
    urlHint:
      'Link do nagrania (mp4 / webm). Gracz obejrzy klip i wpisze odpowiedź.',
    urlPlaceholder: 'https://…/clip.mp4',
    preview: 'video',
  },
};

export function MediaQuizFields({
  selectedType,
  register,
  watch,
  setValue,
  currentDescription,
  aiPrompt,
  aiThreshold,
  task,
}: MediaQuizFieldsProps) {
  const labels = MEDIA_LABELS[selectedType];
  const mode = watch('mediaMode') ?? 'EXACT';
  const mediaUrl = watch('mediaUrl') ?? '';

  return (
    <div className="flex flex-col gap-3">
      <Field label={labels.urlLabel} hint={labels.urlHint}>
        <input
          {...register('mediaUrl')}
          type="url"
          placeholder={labels.urlPlaceholder}
          className={inputClass()}
        />
      </Field>

      {mediaUrl && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          {labels.preview === 'audio' && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={mediaUrl} className="w-full" />
          )}
          {labels.preview === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt="Podgląd zadania"
              className="max-h-48 rounded-md mx-auto"
            />
          )}
          {labels.preview === 'video' && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video controls src={mediaUrl} className="max-h-48 w-full" />
          )}
        </div>
      )}

      <Field
        label="Tryb weryfikacji"
        hint="EXACT porównuje odpowiedź dosłownie (case-insensitive); AI ocenia w oparciu o prompt i próg."
      >
        <div className="flex gap-2">
          {(['EXACT', 'AI'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setValue('mediaMode', m, { shouldDirty: true })}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                mode === m
                  ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35] font-semibold'
                  : 'border-gray-200 text-gray-600 hover:border-orange-200'
              }`}
            >
              {m === 'EXACT' ? 'Dokładna odpowiedź' : 'Ocena AI'}
            </button>
          ))}
        </div>
      </Field>

      {mode === 'EXACT' && (
        <Field
          label="Poprawna odpowiedź"
          hint='Porównanie ignoruje wielkość liter i białe znaki. Wpisz dokładnie to, co powinien wpisać gracz (np. "pies", "Wawel").'
        >
          <input
            {...register('expectedAnswer')}
            type="text"
            placeholder={task ? '(bez zmian)' : 'np. pies'}
            className={inputClass()}
          />
        </Field>
      )}

      {mode === 'AI' && (
        <AIVerifySection
          type={selectedType as never}
          prompt={aiPrompt}
          threshold={aiThreshold}
          description={currentDescription}
          onPromptChange={(v) => setValue('aiPrompt', v)}
          onThresholdChange={(v) => setValue('aiThreshold', v)}
        />
      )}
    </div>
  );
}
