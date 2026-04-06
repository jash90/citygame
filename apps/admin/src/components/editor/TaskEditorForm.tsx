'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { TaskType, UnlockMethod } from '@citygame/shared';
import type { Task, CreateTaskDto } from '@citygame/shared';
import { TaskTypeSelector } from './TaskTypeSelector';
import { AIPromptEditor } from './AIPromptEditor';
import { AIGenerateButton } from './AIGenerateButton';
import { HintEditor } from './HintEditor';
import type { HintItem } from './HintEditor';

// ─── Schema ───────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany'),
  description: z.string().min(1, 'Opis jest wymagany'),
  type: z.nativeEnum(TaskType),
  unlockMethod: z.nativeEnum(UnlockMethod),
  orderIndex: z.coerce.number().min(0),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  maxPoints: z.coerce.number().min(1, 'Minimum 1 punkt'),
  timeLimitSec: z.coerce.number().optional(),
  // AI verify config fields — optional, only used for AI types
  aiPrompt: z.string().optional(),
  aiThreshold: z.coerce.number().min(0).max(1).optional(),
  // Exact-answer config
  answerHash: z.string().optional(),
  // QR config
  qrHash: z.string().optional(),
  // GPS radius
  gpsRadius: z.coerce.number().optional(),
  // Story context fields (serialized to JSON as storyContext)
  characterName: z.string().optional(),
  locationIntro: z.string().optional(),
  taskNarrative: z.string().optional(),
  clueRevealed: z.string().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inputClass(error?: string) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, error, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── AI Verify config section ─────────────────────────────────────────────────

function AIVerifySection({
  type,
  prompt,
  threshold,
  description,
  onPromptChange,
  onThresholdChange,
}: {
  type: TaskType.PHOTO_AI | TaskType.TEXT_AI | TaskType.AUDIO_AI;
  prompt: string;
  threshold: number;
  description: string;
  onPromptChange: (v: string) => void;
  onThresholdChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Prompt weryfikacyjny AI">
        <AIPromptEditor
          value={prompt}
          onChange={onPromptChange}
          taskType={type}
          taskDescription={description}
          threshold={threshold}
        />
      </Field>
      <Field label="Próg akceptacji (0.0–1.0)" hint="Np. 0.7 = 70% pewności wymagane do zaliczenia">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="flex-1 accent-[#FF6B35]"
          />
          <span className="text-sm font-bold text-[#FF6B35] w-10 text-right tabular-nums">
            {threshold.toFixed(2)}
          </span>
        </div>
      </Field>
    </div>
  );
}

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
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      type: task?.type ?? TaskType.QR_SCAN,
      unlockMethod: task?.unlockMethod ?? UnlockMethod.QR,
      orderIndex: task?.orderIndex ?? 0,
      latitude: task?.latitude ?? 0,
      longitude: task?.longitude ?? 0,
      maxPoints: task?.maxPoints ?? 100,
      timeLimitSec: task?.timeLimitSec,
      aiPrompt: (() => {
        const vc = task?.verifyConfig;
        if (vc && ('prompt' in vc)) return vc.prompt;
        return '';
      })(),
      aiThreshold: (() => {
        const vc = task?.verifyConfig;
        if (vc && ('threshold' in vc)) return vc.threshold;
        return 0.7;
      })(),
      answerHash: (() => {
        const vc = task?.verifyConfig;
        if (vc && ('answerHash' in vc)) return vc.answerHash;
        return '';
      })(),
      qrHash: (() => {
        const vc = task?.verifyConfig;
        if (vc && vc.type === 'QR_SCAN') return vc.expectedHash;
        const uc = task?.unlockConfig;
        if (uc && uc.method === 'QR') return uc.expectedHash;
        return '';
      })(),
      gpsRadius: (() => {
        const vc = task?.verifyConfig;
        if (vc && vc.type === 'GPS_REACH') return vc.radiusMeters;
        return 50;
      })(),
      ...(() => {
        try {
          const ctx = task?.storyContext ? JSON.parse(task.storyContext) : {};
          return {
            characterName: ctx.characterName ?? '',
            locationIntro: ctx.locationIntro ?? '',
            taskNarrative: ctx.taskNarrative ?? '',
            clueRevealed: ctx.clueRevealed ?? '',
          };
        } catch {
          return { characterName: '', locationIntro: '', taskNarrative: '', clueRevealed: '' };
        }
      })(),
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
      // Parse AI-generated hints (newline-separated)
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

  const onFormSubmit = (data: FormValues) => {
    let verifyConfig: CreateTaskDto['verifyConfig'];

    switch (data.type) {
      case TaskType.QR_SCAN:
        verifyConfig = { type: 'QR_SCAN', expectedHash: data.qrHash ?? '' };
        break;
      case TaskType.GPS_REACH:
        verifyConfig = {
          type: 'GPS_REACH',
          latitude: data.latitude,
          longitude: data.longitude,
          radiusMeters: data.gpsRadius ?? 50,
        };
        break;
      case TaskType.PHOTO_AI:
        verifyConfig = {
          type: 'PHOTO_AI',
          prompt: data.aiPrompt ?? '',
          threshold: data.aiThreshold ?? 0.7,
        };
        break;
      case TaskType.TEXT_AI:
        verifyConfig = {
          type: 'TEXT_AI',
          prompt: data.aiPrompt ?? '',
          threshold: data.aiThreshold ?? 0.7,
        };
        break;
      case TaskType.AUDIO_AI:
        verifyConfig = {
          type: 'AUDIO_AI',
          prompt: data.aiPrompt ?? '',
          threshold: data.aiThreshold ?? 0.7,
        };
        break;
      case TaskType.TEXT_EXACT:
        verifyConfig = { type: 'TEXT_EXACT', answerHash: data.answerHash ?? '' };
        break;
      case TaskType.CIPHER:
        verifyConfig = { type: 'CIPHER', answerHash: data.answerHash ?? '' };
        break;
      default:
        verifyConfig = { type: 'MIXED', steps: [] };
    }

    const unlockConfig: CreateTaskDto['unlockConfig'] =
      data.unlockMethod === UnlockMethod.QR
        ? { method: 'QR', expectedHash: data.qrHash ?? '' }
        : data.unlockMethod === UnlockMethod.NONE
          ? { method: 'NONE' }
          : {
              method: 'GPS',
              latitude: data.latitude,
              longitude: data.longitude,
              radiusMeters: data.gpsRadius ?? 50,
            };

    // Serialize story context fields into a JSON string
    const hasStoryContext =
      data.characterName || data.locationIntro || data.taskNarrative || data.clueRevealed;
    const storyContext = hasStoryContext
      ? JSON.stringify({
          characterName: data.characterName || undefined,
          locationIntro: data.locationIntro || undefined,
          taskNarrative: data.taskNarrative || undefined,
          clueRevealed: data.clueRevealed || undefined,
        })
      : undefined;

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
      unlockConfig,
      verifyConfig,
      ...(storyContext ? { storyContext } : {}),
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
      <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setStoryContextOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-[#FF6B35] transition-colors"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${storyContextOpen ? 'rotate-0' : '-rotate-90'}`}
          />
          Kontekst fabularny
        </button>

        {storyContextOpen && (
          <div className="flex flex-col gap-3">
            <Field label="Nazwa postaci">
              <input
                {...register('characterName')}
                placeholder="np. Stary Kronikarz"
                className={inputClass()}
              />
            </Field>
            <Field label="Wprowadzenie do lokacji">
              <textarea
                {...register('locationIntro')}
                rows={2}
                placeholder="Narracja gdy gracz dociera do lokacji..."
                className={`${inputClass()} resize-none`}
              />
            </Field>
            <Field label="Narracja zadania">
              <textarea
                {...register('taskNarrative')}
                rows={2}
                placeholder="Kontekst fabularny przed zadaniem..."
                className={`${inputClass()} resize-none`}
              />
            </Field>
            <Field label="Odkryta wskazówka">
              <textarea
                {...register('clueRevealed')}
                rows={2}
                placeholder="Wskazówka odkryta po wykonaniu zadania..."
                className={`${inputClass()} resize-none`}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Points + time */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Maks. punkty" error={errors.maxPoints?.message}>
          <input
            {...register('maxPoints')}
            type="number"
            className={inputClass(errors.maxPoints?.message)}
          />
        </Field>
        <Field label="Limit czasu (sek)">
          <input
            {...register('timeLimitSec')}
            type="number"
            placeholder="Brak limitu"
            className={inputClass()}
          />
        </Field>
      </div>

      {/* Order index */}
      <Field label="Kolejność" error={errors.orderIndex?.message}>
        <input
          {...register('orderIndex')}
          type="number"
          min={0}
          className={inputClass(errors.orderIndex?.message)}
        />
      </Field>

      {/* Location picker */}
      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-[#FF6B35]" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Lokalizacja
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Szerokość (lat)"
            error={errors.latitude?.message}
            hint="np. 52.229676"
          >
            <input
              {...register('latitude')}
              type="number"
              step="0.000001"
              placeholder="52.229676"
              className={inputClass(errors.latitude?.message)}
            />
          </Field>
          <Field
            label="Długość (lon)"
            error={errors.longitude?.message}
            hint="np. 21.012229"
          >
            <input
              {...register('longitude')}
              type="number"
              step="0.000001"
              placeholder="21.012229"
              className={inputClass(errors.longitude?.message)}
            />
          </Field>
        </div>
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Format DD.DDDDDD (stopnie dziesiętne). Przykład: 52.229676, 21.012229 (Warszawa).
          Kopiuj ze strony: maps.google.com → kliknij prawym przyciskiem → „Co to jest?"
        </p>
      </div>

      {/* Verify config */}
      <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Konfiguracja weryfikacji
        </p>

        {selectedType === TaskType.QR_SCAN && (
          <Field label="Hash QR kodu" error={errors.qrHash?.message}>
            <input
              {...register('qrHash')}
              placeholder="np. sha256:abc123..."
              className={inputClass(errors.qrHash?.message)}
            />
          </Field>
        )}

        {selectedType === TaskType.GPS_REACH && (
          <Field label="Promień akceptacji (m)">
            <input
              {...register('gpsRadius')}
              type="number"
              min={10}
              max={5000}
              className={inputClass()}
            />
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
            <input
              {...register('answerHash')}
              type="text"
              placeholder="sha256 hasha odpowiedzi"
              className={inputClass()}
            />
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
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Podpowiedzi
        </p>
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
