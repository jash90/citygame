import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2).max(50),
});

export const gameSettingsSchema = z.object({
  maxPlayers: z.number().int().positive().optional(),
  timeLimitMinutes: z.number().int().positive().optional(),
  allowLateJoin: z.boolean().optional(),
});

export const createGameSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  city: z.string().min(2).max(100),
  coverImageUrl: z.string().url().optional(),
  settings: gameSettingsSchema.optional(),
});

export const updateGameSchema = createGameSchema.partial();

export const unlockConfigSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('QR'), expectedHash: z.string() }),
  z.object({
    method: z.literal('GPS'),
    latitude: z.number(),
    longitude: z.number(),
    radiusMeters: z.number().positive(),
  }),
]);

export const verifyConfigSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('QR_SCAN'), expectedHash: z.string() }),
    z.object({
      type: z.literal('GPS_REACH'),
      latitude: z.number(),
      longitude: z.number(),
      radiusMeters: z.number().positive(),
    }),
    z.object({
      type: z.literal('TEXT_EXACT'),
      answerHash: z.string(),
      caseSensitive: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('PHOTO_AI'),
      prompt: z.string().min(10),
      threshold: z.number().min(0).max(1),
      maxTokens: z.number().int().positive().optional(),
    }),
    z.object({
      type: z.literal('TEXT_AI'),
      prompt: z.string().min(10),
      threshold: z.number().min(0).max(1),
      maxTokens: z.number().int().positive().optional(),
    }),
    z.object({
      type: z.literal('AUDIO_AI'),
      prompt: z.string().min(10),
      threshold: z.number().min(0).max(1),
    }),
    z.object({
      type: z.literal('CIPHER'),
      answerHash: z.string(),
      cipherHint: z.string().optional(),
    }),
    z.object({
      type: z.literal('MIXED'),
      steps: z.array(z.lazy(() => verifyConfigSchema)),
    }),
  ]),
);

export const createTaskSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  type: z.enum([
    'QR_SCAN',
    'GPS_REACH',
    'PHOTO_AI',
    'AUDIO_AI',
    'TEXT_EXACT',
    'TEXT_AI',
    'CIPHER',
    'MIXED',
  ]),
  unlockMethod: z.enum(['QR', 'GPS']),
  orderIndex: z.number().int().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  unlockConfig: unlockConfigSchema,
  verifyConfig: verifyConfigSchema,
  maxPoints: z.number().int().positive(),
  timeLimitSec: z.number().int().positive().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const submissionSchema = z.object({
  answer: z.string().optional(),
  scannedCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  mediaUrl: z.string().url().optional(),
});
