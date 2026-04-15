'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { TaskType } from '@citygame/shared';
import type { Task, CreateTaskDto } from '@citygame/shared';
import { TaskTypeSelector } from './TaskTypeSelector';
import { AIGenerateButton } from './AIGenerateButton';
import { HintEditor } from './HintEditor';
import { AIVerifySection } from './AIVerifySection';
import { StoryContextSection } from './StoryContextSection';
import { LocationSection } from './LocationSection';
import type { HintItem } from './HintEditor';
import {
  taskEditorSchema,
  type TaskFormValues,
  inputClass,
  Field,
  buildVerifyConfig,
  buildUnlockConfig,
  buildStoryContext,
  parseStoryContext,
  parseVerifyDefaults,
} from './taskEditor.utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskEditorFormProps {
  task?: Task | null;
  gameId: string;
  onSubmit: (data: CreateTaskDto) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskEditorForm({
  task,
  gameId,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: TaskEditorFormProps) {
  const storyCtx = parseStoryContext(task ?? undefined);
  const verifyDefaults = parseVerifyDefaults(task ?? undefined);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskEditorSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      type: task?.type ?? TaskType.QR_SCAN,
      unlockMethod: task?.unlockMethod ?? ('QR' as never),
      orderIndex: task?.orderIndex ?? 0,
      latitude: task?.latitude ?? 0,
      longitude: task?.longitude ?? 0,
      maxPoints: task?.maxPoints ?? 100,
      timeLimitSec: task?.timeLimitSec,
      aiPrompt: verifyDefaults.aiPrompt,
      aiThreshold: verifyDefaults.aiThreshold,
      answerHash: verifyDefaults.answerHash,
      qrHash: verifyDefaults.qrHash,
      gpsRadius: verifyDefaults.gpsRadius,
      ...storyCtx,
    },
  });

  const [storyContextOpen, setStoryContextOpen] = useState(false);

  const [hints, setHints] = useState<HintItem[]>(() =>
    (task?.hints ?? []).map((h, i) => ({
      _key: `hint-init-${i}`,
      id: h.id,
      content: h.content,
      pointPenalty: h.pointPenalty,
      orderIndex: h.orderIndex,
    })),
  );

  const selectedType = watch('type');
  const currentTitle = watch('title');
  const currentDescription = watch('description');
  const aiPrompt = watch('aiPrompt') ?? '';
  const aiThreshold = watch('aiThreshold') ?? 0.7;

  const isAIType =
    selectedType === TaskType.PHOTO_AI ||
    selectedType === TaskType.TEXT_AI ||
    selectedType === TaskType.AUDIO_AI;

  const handleAIApply = (type: 'description' | 'hints' | 'prompt', content: string) => {
    if (type === 'description') setValue('description', content);
    if (type === 'prompt') setValue('aiPrompt', content);
    if (type === 'hints') {
      const lines = content
        .split('\n')
        .map((l) => l.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
      setHints(
        lines.map((content, i) => ({
          _key: `hint-ai-${i}`,
          content,
          pointPenalty: 10,
          orderIndex: i,
        })),
      );
    }
  };

  const onFormSubmit = (data: TaskFormValues) => {
    onSubmit({
      title: data.title,
      description: data.description,
      type: data.type,
      unlockMethod: data.unlockMethod,
      orderIndex: data.orderIndex,
      latitude: data.latitude,
      longitude: data.longitude,
      maxPoints: data.maxPoints,
      timeLimitSec: data.timeLimitSec,
      unlockConfig: buildUnlockConfig(data),
      verifyConfig: buildVerifyConfig(data) as unknown as CreateTaskDto['verifyConfig'],
      ...(buildStoryContext(data) ? { storyContext: buildStoryContext(data) } : {}),
    } as CreateTaskDto);
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="flex flex-col gap-5 p-5 h-full overflow-y-auto"
    >
      {/* Header with AI generate button */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          {task ? 'Edytuj zadanie' : 'Nowe zadanie'}
        </h2>
        <AIGenerateButton
          gameId={gameId}
          taskTitle={currentTitle}
          taskDescription={currentDescription}
          taskType={selectedType}
          onApply={handleAIApply}
        />
      </div>

      {/* Task type selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Typ zadania</label>
        <TaskTypeSelector
          value={selectedType}
          onChange={(type) => setValue('type', type)}
        />
        {errors.type && (
          <p className="text-xs text-red-600">{errors.type.message}</p>
        )}
      </div>

      {/* Title */}
      <Field label="Tytuł" error={errors.title?.message}>
        <input
          {...register('title')}
          placeholder="Nazwa zadania"
          className={inputClass(errors.title?.message)}
        />
      </Field>

      {/* Description */}
      <Field label="Opis" error={errors.description?.message}>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Opis dla gracza..."
          className={`${inputClass(errors.description?.message)} resize-none`}
        />
      </Field>

      {/* Story context — collapsible */}
      <StoryContextSection
        register={register}
        storyContextOpen={storyContextOpen}
        onToggle={() => setStoryContextOpen((v) => !v)}
      />

      {/* Points + time */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Maks. punkty" error={errors.maxPoints?.message}>
          <input {...register('maxPoints')} type="number" className={inputClass(errors.maxPoints?.message)} />
        </Field>
        <Field label="Limit czasu (sek)">
          <input {...register('timeLimitSec')} type="number" placeholder="Brak limitu" className={inputClass()} />
        </Field>
      </div>

      {/* Order index */}
      <Field label="Kolejność" error={errors.orderIndex?.message}>
        <input {...register('orderIndex')} type="number" min={0} className={inputClass(errors.orderIndex?.message)} />
      </Field>

      {/* Location picker */}
      <LocationSection register={register} errors={errors} />

      {/* Verify config */}
      <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Konfiguracja weryfikacji
        </p>

        {selectedType === TaskType.QR_SCAN && (
          <Field label="Hash QR kodu" error={errors.qrHash?.message}>
            <input {...register('qrHash')} placeholder="np. sha256:abc123..." className={inputClass(errors.qrHash?.message)} />
          </Field>
        )}

        {selectedType === TaskType.GPS_REACH && (
          <Field label="Promień akceptacji (m)">
            <input {...register('gpsRadius')} type="number" min={10} max={5000} className={inputClass()} />
          </Field>
        )}

        {isAIType && (
          <AIVerifySection
            type={selectedType as TaskType.PHOTO_AI | TaskType.TEXT_AI | TaskType.AUDIO_AI}
            prompt={aiPrompt}
            threshold={aiThreshold}
            description={currentDescription}
            onPromptChange={(v) => setValue('aiPrompt', v)}
            onThresholdChange={(v) => setValue('aiThreshold', v)}
          />
        )}

        {(selectedType === TaskType.TEXT_EXACT || selectedType === TaskType.CIPHER) && (
          <Field label="Hash poprawnej odpowiedzi" hint="SHA-256 hash oczekiwanej odpowiedzi">
            <input {...register('answerHash')} type="text" placeholder="sha256 hasha odpowiedzi" className={inputClass()} />
          </Field>
        )}

        {selectedType === TaskType.MIXED && (
          <p className="text-sm text-gray-500 italic">
            Konfiguracja kroków dla typu MIXED jest dostępna po zapisaniu zadania.
          </p>
        )}
      </div>

      {/* Hints section */}
      <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Podpowiedzi</p>
        <HintEditor hints={hints} onChange={setHints} maxHints={3} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 mt-auto">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 text-sm rounded-lg bg-[#FF6B35] text-white font-medium hover:bg-[#e55a26] disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Zapisywanie...' : task ? 'Zapisz zmiany' : 'Dodaj zadanie'}
        </button>
      </div>
    </form>
  );
}
