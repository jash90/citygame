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
  /** Plaintext expected answer for TEXT_EXACT / CIPHER (top-level types). */
  expectedAnswer: z.string().optional(),
  /** Plaintext QR code content for QR_SCAN as the verify type. */
  qrAnswer: z.string().optional(),
  /** Hash for unlock-method QR (still hash; admin pastes/exports it). */
  qrHash: z.string().optional(),
  gpsRadius: z.coerce.number().optional(),
  /** Mentor rubric for PRACTICAL tasks. */
  practicalCriteria: z.string().optional(),
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
      return { type: 'QR_SCAN', expectedAnswer: data.qrAnswer ?? '' };
    case T.GPS_REACH:
      return { type: 'GPS_REACH', latitude: data.latitude, longitude: data.longitude, radiusMeters: data.gpsRadius ?? 50 };
    case T.PHOTO_AI:
      return { type: 'PHOTO_AI', prompt: data.aiPrompt ?? '', threshold: data.aiThreshold ?? 0.7 };
    case T.TEXT_AI:
      return { type: 'TEXT_AI', prompt: data.aiPrompt ?? '', threshold: data.aiThreshold ?? 0.7 };
    case T.AUDIO_AI:
      return { type: 'AUDIO_AI', prompt: data.aiPrompt ?? '', threshold: data.aiThreshold ?? 0.7 };
    case T.TEXT_EXACT:
      return { type: 'TEXT_EXACT', expectedAnswer: data.expectedAnswer ?? '' };
    case T.CIPHER:
      return { type: 'CIPHER', expectedAnswer: data.expectedAnswer ?? '' };
    case T.AUDIO:
      return { type: 'AUDIO' };
    case T.PHOTO:
      return { type: 'PHOTO' };
    case T.VIDEO:
      return { type: 'VIDEO' };
    case T.PRACTICAL:
      return { type: 'PRACTICAL', criteria: data.practicalCriteria ?? '' };
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
  const empty = {
    characterName: '',
    locationIntro: '',
    taskNarrative: '',
    clueRevealed: '',
  };
  if (!task?.storyContext) return empty;
  try {
    const parsed = JSON.parse(task.storyContext);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        characterName: typeof parsed.characterName === 'string' ? parsed.characterName : '',
        locationIntro: typeof parsed.locationIntro === 'string' ? parsed.locationIntro : '',
        taskNarrative: typeof parsed.taskNarrative === 'string' ? parsed.taskNarrative : '',
        clueRevealed: typeof parsed.clueRevealed === 'string' ? parsed.clueRevealed : '',
      };
    }
    return { ...empty, taskNarrative: String(parsed) };
  } catch {
    return { ...empty, taskNarrative: task.storyContext };
  }
}

export function parseVerifyDefaults(task: { verifyConfig?: unknown; unlockConfig?: unknown } | undefined) {
  const vc = task?.verifyConfig as Record<string, unknown> | undefined;
  const uc = task?.unlockConfig as Record<string, unknown> | undefined;
  return {
    aiPrompt: vc && 'prompt' in vc ? (vc.prompt as string) : '',
    aiThreshold: vc && 'threshold' in vc ? (vc.threshold as number) : 0.7,
    expectedAnswer:
      (vc?.type === 'TEXT_EXACT' || vc?.type === 'CIPHER') &&
      typeof vc.expectedAnswer === 'string'
        ? vc.expectedAnswer
        : '',
    qrAnswer:
      vc?.type === 'QR_SCAN' && typeof vc.expectedAnswer === 'string'
        ? vc.expectedAnswer
        : '',
    qrHash: uc?.method === 'QR' ? ((uc.expectedHash as string) ?? '') : '',
    gpsRadius: vc?.type === 'GPS_REACH' ? (vc.radiusMeters as number) : 50,
    practicalCriteria:
      vc?.type === 'PRACTICAL' && typeof vc.criteria === 'string'
        ? vc.criteria
        : '',
  };
}
