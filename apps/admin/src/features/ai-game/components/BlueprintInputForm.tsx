'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { GameFlowType, TaskType } from '@citygame/shared';
import type { BlueprintInput } from '@citygame/shared';
import { isCreditsError } from '../lib/errorClassification';

const TASK_TYPE_VALUES = Object.values(TaskType) as TaskType[];
const MIXED_COMPONENT_VALUES = TASK_TYPE_VALUES.filter(
  (t) => t !== TaskType.MIXED,
);

const inputSchema = z.object({
  city: z.string().min(2, 'Min. 2 znaki').max(100),
  theme: z.string().min(3, 'Min. 3 znaki').max(280),
  flowType: z.nativeEnum(GameFlowType),
  taskCount: z.coerce.number().int().min(3).max(20),
  durationMinutes: z.coerce.number().int().min(15).max(360),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  language: z.string().min(2).max(8),
  audience: z.string().max(120).optional(),
  tone: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  allowedTaskTypes: z
    .array(z.nativeEnum(TaskType))
    .min(1, 'Wybierz co najmniej jeden typ zadania'),
  mixedComponentTypes: z.array(z.nativeEnum(TaskType)),
  endingCount: z.coerce.number().int().min(2).max(6),
  useWebSearch: z.boolean().optional(),
  storyMode: z.enum(['NONE', 'FLAVOR', 'FULL_NARRATIVE']).optional(),
}).superRefine((val, ctx) => {
  if (
    val.allowedTaskTypes.includes(TaskType.MIXED) &&
    val.mixedComponentTypes.length < 2
  ) {
    ctx.addIssue({
      path: ['mixedComponentTypes'],
      code: z.ZodIssueCode.custom,
      message: 'MIXED łączy co najmniej 2 typy',
    });
  }
});

type FormValues = z.infer<typeof inputSchema>;

interface BlueprintInputFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: BlueprintInput) => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
}

const FLOW_DESCRIPTIONS: Record<GameFlowType, string> = {
  [GameFlowType.LINEAR]: 'Liniowa: zadania w stałej kolejności, jedno zakończenie.',
  [GameFlowType.BRANCHING]: 'Rozgałęziona: wybory prowadzą do różnych ścieżek i zakończeń.',
  [GameFlowType.OPEN_WORLD]: 'Otwarty świat: każde zadanie dostępne od początku.',
  [GameFlowType.MIXED]: 'Mieszana: hub-and-spoke, centralne miejsce + odnogi.',
};

const DIFFICULTY_LABELS = {
  EASY: 'Łatwa',
  MEDIUM: 'Średnia',
  HARD: 'Trudna',
} as const;

const TASK_TYPE_LABELS: Record<TaskType, { title: string; hint: string }> = {
  [TaskType.QR_SCAN]: { title: 'Skan QR', hint: 'Zeskanuj kod QR w terenie' },
  [TaskType.GPS_REACH]: {
    title: 'Dotarcie GPS',
    hint: 'Wejdź w wyznaczony obszar',
  },
  [TaskType.PHOTO_AI]: { title: 'Zdjęcie (AI)', hint: 'Sfotografuj obiekt' },
  [TaskType.AUDIO_AI]: { title: 'Audio (AI)', hint: 'Nagranie głosowe' },
  [TaskType.TEXT_EXACT]: {
    title: 'Odpowiedź dokładna',
    hint: 'Konkretne hasło / liczba',
  },
  [TaskType.TEXT_AI]: { title: 'Tekst (AI)', hint: 'Otwarta wypowiedź' },
  [TaskType.CIPHER]: { title: 'Szyfr', hint: 'Rozszyfruj kod łańcucha' },
  [TaskType.MIXED]: {
    title: 'Mieszane',
    hint: 'Łączy kilka typów w jednym zadaniu',
  },
};

function inputClass(error?: string) {
  return `w-full px-4 py-2.5 text-sm border rounded-xl outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function BlueprintInputForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  errorMessage,
}: BlueprintInputFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(inputSchema),
    defaultValues: {
      city: defaultValues?.city ?? '',
      theme: defaultValues?.theme ?? '',
      flowType: defaultValues?.flowType ?? GameFlowType.LINEAR,
      taskCount: defaultValues?.taskCount ?? 8,
      durationMinutes: defaultValues?.durationMinutes ?? 90,
      difficulty: defaultValues?.difficulty ?? 'MEDIUM',
      language: defaultValues?.language ?? 'pl',
      audience: defaultValues?.audience ?? '',
      tone: defaultValues?.tone ?? '',
      notes: defaultValues?.notes ?? '',
      allowedTaskTypes: defaultValues?.allowedTaskTypes ?? TASK_TYPE_VALUES,
      mixedComponentTypes:
        defaultValues?.mixedComponentTypes?.filter(
          (t) => t !== TaskType.MIXED,
        ) ?? MIXED_COMPONENT_VALUES,
      endingCount: defaultValues?.endingCount ?? 3,
      useWebSearch: defaultValues?.useWebSearch ?? false,
      storyMode: defaultValues?.storyMode ?? 'FLAVOR',
    },
  });

  const flowType = watch('flowType');
  const allowedTaskTypes = watch('allowedTaskTypes') ?? [];
  const mixedAllowed = allowedTaskTypes.includes(TaskType.MIXED);
  const supportsMultipleEndings = flowType !== GameFlowType.LINEAR;

  return (
    <form
      onSubmit={handleSubmit((v) =>
        onSubmit({
          ...v,
          audience: v.audience?.trim() || undefined,
          tone: v.tone?.trim() || undefined,
          notes: v.notes?.trim() || undefined,
          mixedComponentTypes: v.allowedTaskTypes.includes(TaskType.MIXED)
            ? v.mixedComponentTypes
            : undefined,
          endingCount:
            v.flowType === GameFlowType.LINEAR ? undefined : v.endingCount,
        } as BlueprintInput),
      )}
      className="flex flex-col gap-5"
      noValidate
    >
      {errorMessage && (
        isCreditsError(errorMessage) ? (
          <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-700" />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="font-semibold">Brak kredytów na koncie OpenRouter</p>
              <p className="text-amber-800">
                Generator nie może wykonać zapytania, ponieważ konto OpenRouter
                nie ma wystarczających środków na pokrycie tokenów modelu.
                Doładuj konto i spróbuj ponownie — formularz powyżej pozostaje
                wypełniony.
              </p>
              <a
                href="https://openrouter.ai/settings/credits"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 self-start mt-1 px-3 py-1.5 rounded-md bg-amber-900 text-white text-xs font-semibold hover:bg-amber-800"
              >
                Doładuj konto OpenRouter
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMessage}
          </div>
        )
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Miasto" error={errors.city?.message}>
          <input
            {...register('city')}
            placeholder="np. Wrocław"
            className={inputClass(errors.city?.message)}
          />
        </Field>
        <Field label="Język" error={errors.language?.message}>
          <input
            {...register('language')}
            className={inputClass(errors.language?.message)}
          />
        </Field>
      </div>

      <Field
        label="Motyw / temat"
        error={errors.theme?.message}
        hint="np. szlak legend miejskich, śladami partyzantów, pogrzeb wina"
      >
        <input
          {...register('theme')}
          className={inputClass(errors.theme?.message)}
        />
      </Field>

      <div>
        <label className="text-sm font-medium text-gray-700">
          Typ rozgrywki
        </label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.values(GameFlowType).map((value) => (
            <label
              key={value}
              className={`flex flex-col gap-1 rounded-lg border p-3 cursor-pointer transition-colors ${
                flowType === value
                  ? 'border-[#FF6B35] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <input
                  type="radio"
                  value={value}
                  className="accent-[#FF6B35]"
                  {...register('flowType')}
                />
                {value}
              </span>
              <span className="text-xs text-gray-500">
                {FLOW_DESCRIPTIONS[value]}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">
          Dozwolone typy zadań
        </label>
        <p className="text-xs text-gray-400 mt-0.5">
          AI wykorzysta tylko zaznaczone typy. Domyślnie wszystkie.
        </p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TASK_TYPE_VALUES.map((value) => {
            const meta = TASK_TYPE_LABELS[value];
            const checked =
              watch('allowedTaskTypes')?.includes(value) ?? false;
            return (
              <label
                key={value}
                className={`flex flex-col gap-1 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-[#FF6B35] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    value={value}
                    className="accent-[#FF6B35]"
                    {...register('allowedTaskTypes')}
                  />
                  {meta.title}
                </span>
                <span className="text-xs text-gray-500">{meta.hint}</span>
              </label>
            );
          })}
        </div>
        {errors.allowedTaskTypes?.message && (
          <p className="text-xs text-red-600 mt-1">
            {errors.allowedTaskTypes.message}
          </p>
        )}
      </div>

      {mixedAllowed && (
        <div>
          <label className="text-sm font-medium text-gray-700">
            Komponenty zadań MIXED
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            AI łączy 2+ z zaznaczonych typów w jednym zadaniu MIXED.
          </p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MIXED_COMPONENT_VALUES.map((value) => {
              const meta = TASK_TYPE_LABELS[value];
              const checked =
                watch('mixedComponentTypes')?.includes(value) ?? false;
              return (
                <label
                  key={value}
                  className={`flex flex-col gap-1 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked
                      ? 'border-[#FF6B35] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      value={value}
                      className="accent-[#FF6B35]"
                      {...register('mixedComponentTypes')}
                    />
                    {meta.title}
                  </span>
                  <span className="text-xs text-gray-500">{meta.hint}</span>
                </label>
              );
            })}
          </div>
          {errors.mixedComponentTypes?.message && (
            <p className="text-xs text-red-600 mt-1">
              {errors.mixedComponentTypes.message}
            </p>
          )}
        </div>
      )}

      <div
        className={`grid gap-4 ${
          supportsMultipleEndings
            ? 'grid-cols-2 sm:grid-cols-4'
            : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        <Field label="Liczba zadań" error={errors.taskCount?.message}>
          <input
            {...register('taskCount')}
            type="number"
            min={3}
            max={20}
            className={inputClass(errors.taskCount?.message)}
          />
        </Field>
        {supportsMultipleEndings && (
          <Field
            label="Liczba zakończeń"
            error={errors.endingCount?.message}
            hint="2–6 (BRANCHING/OPEN_WORLD/MIXED)"
          >
            <input
              {...register('endingCount')}
              type="number"
              min={2}
              max={6}
              className={inputClass(errors.endingCount?.message)}
            />
          </Field>
        )}
        <Field
          label="Czas (min)"
          error={errors.durationMinutes?.message}
          hint="15–360"
        >
          <input
            {...register('durationMinutes')}
            type="number"
            min={15}
            max={360}
            className={inputClass(errors.durationMinutes?.message)}
          />
        </Field>
        <Field label="Trudność" error={errors.difficulty?.message}>
          <select
            {...register('difficulty')}
            className={inputClass(errors.difficulty?.message)}
          >
            {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tryb narracji" error={errors.storyMode?.message}>
          <select
            {...register('storyMode')}
            className={inputClass(errors.storyMode?.message)}
          >
            <option value="NONE">Brak postaci NPC</option>
            <option value="FLAVOR">Postaci NPC (rekomendowane)</option>
            <option value="FULL_NARRATIVE" disabled>Pełna narracja (wkrótce)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Grupa docelowa (opc.)">
          <input
            {...register('audience')}
            placeholder="np. rodziny z dziećmi, studenci"
            className={inputClass()}
          />
        </Field>
        <Field label="Ton (opc.)">
          <input
            {...register('tone')}
            placeholder="np. tajemniczy, edukacyjny, komediowy"
            className={inputClass()}
          />
        </Field>
      </div>

      <Field
        label="Dodatkowe wskazówki (opc.)"
        hint="np. konkretne POI do uwzględnienia, ograniczenia, akcent na cipher chain"
      >
        <textarea
          {...register('notes')}
          rows={3}
          className={`${inputClass()} resize-none`}
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60 transition-colors shadow-sm"
        >
          {isSubmitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          Generuj grę
        </button>
      </div>
    </form>
  );
}

// `isCreditsError` lives in `../lib/errorClassification` so the
// stage-by-stage GenerationStatusBanner can reuse the same matcher.
