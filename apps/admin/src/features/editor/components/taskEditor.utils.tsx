import { TaskType as TaskTypeEnum, UnlockMethod as UnlockMethodEnum } from '@citygame/shared';
import { z } from 'zod';

export const taskEditorSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany'),
  description: z.string().min(1, 'Opis jest wymagany'),
  type: z.nativeEnum(TaskTypeEnum),
  unlockMethod: z.nativeEnum(UnlockMethodEnum),
  orderIndex: z.coerce.number().min(0),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  maxPoints: z.coerce.number().min(1, 'Minimum 1 punkt'),
  timeLimitSec: z.coerce.number().optional(),
  aiPrompt: z.string().optional(),
  aiThreshold: z.coerce.number().min(0).max(1).optional(),
  answerHash: z.string().optional(),
  qrHash: z.string().optional(),
  gpsRadius: z.coerce.number().optional(),
  characterName: z.string().optional(),
  locationIntro: z.string().optional(),
  taskNarrative: z.string().optional(),
  clueRevealed: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof taskEditorSchema>;

export function inputClass(error?: string) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

export interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

export function Field({ label, error, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function buildVerifyConfig(
  data: TaskFormValues,
): { type: string; [key: string]: unknown } {
  const T = TaskTypeEnum;
  switch (data.type) {
    case T.QR_SCAN:
      return { type: 'QR_SCAN', expectedHash: data.qrHash ?? '' };
    case T.GPS_REACH:
      return { type: 'GPS_REACH', latitude: data.latitude, longitude: data.longitude, radiusMeters: data.gpsRadius ?? 50 };
    case T.PHOTO_AI:
      return { type: 'PHOTO_AI', prompt: data.aiPrompt ?? '', threshold: data.aiThreshold ?? 0.7 };
    case T.TEXT_AI:
      return { type: 'TEXT_AI', prompt: data.aiPrompt ?? '', threshold: data.aiThreshold ?? 0.7 };
    case T.AUDIO_AI:
      return { type: 'AUDIO_AI', prompt: data.aiPrompt ?? '', threshold: data.aiThreshold ?? 0.7 };
    case T.TEXT_EXACT:
      return { type: 'TEXT_EXACT', answerHash: data.answerHash ?? '' };
    case T.CIPHER:
      return { type: 'CIPHER', answerHash: data.answerHash ?? '' };
    default:
      return { type: 'MIXED', steps: [] };
  }
}

export function buildUnlockConfig(data: TaskFormValues) {
  const U = UnlockMethodEnum;
  if (data.unlockMethod === U.QR) return { method: 'QR' as const, expectedHash: data.qrHash ?? '' };
  if (data.unlockMethod === U.NONE) return { method: 'NONE' as const };
  return { method: 'GPS' as const, latitude: data.latitude, longitude: data.longitude, radiusMeters: data.gpsRadius ?? 50 };
}

export function buildStoryContext(data: TaskFormValues): string | undefined {
  const hasContext = data.characterName || data.locationIntro || data.taskNarrative || data.clueRevealed;
  if (!hasContext) return undefined;
  return JSON.stringify({
    characterName: data.characterName || undefined,
    locationIntro: data.locationIntro || undefined,
    taskNarrative: data.taskNarrative || undefined,
    clueRevealed: data.clueRevealed || undefined,
  });
}

export function parseStoryContext(task: { storyContext?: string | null } | undefined): {
  characterName: string;
  locationIntro: string;
  taskNarrative: string;
  clueRevealed: string;
} {
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
}

export function parseVerifyDefaults(task: { verifyConfig?: unknown; unlockConfig?: unknown } | undefined) {
  const vc = task?.verifyConfig as Record<string, unknown> | undefined;
  const uc = task?.unlockConfig as Record<string, unknown> | undefined;
  return {
    aiPrompt: vc && 'prompt' in vc ? (vc.prompt as string) : '',
    aiThreshold: vc && 'threshold' in vc ? (vc.threshold as number) : 0.7,
    answerHash: vc && 'answerHash' in vc ? (vc.answerHash as string) : '',
    qrHash: vc?.type === 'QR_SCAN'
      ? (vc.expectedHash as string)
      : uc?.method === 'QR'
        ? (uc.expectedHash as string)
        : '',
    gpsRadius: vc?.type === 'GPS_REACH' ? (vc.radiusMeters as number) : 50,
  };
}
