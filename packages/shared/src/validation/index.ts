import { z } from 'zod';
import { TaskType, UnlockMethod } from '../types/task';

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

import { GameFlowType } from '../types/game';

export const gameFlowTypeSchema = z.nativeEnum(GameFlowType);

export const createGameSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  city: z.string().min(2).max(100),
  coverImageUrl: z.string().url().optional(),
  flowType: gameFlowTypeSchema.optional(),
  settings: gameSettingsSchema.optional(),
});

export const updateGameSchema = createGameSchema.partial();

export const revealedItemKindSchema = z.enum([
  'CODE',
  'WORD',
  'SYMBOL',
  'NUMBER',
]);

export const itemSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9_]+$/, 'must be lowercase a-z, 0-9, _');

export const revealedItemSchema = z.object({
  slug: itemSlugSchema,
  kind: revealedItemKindSchema,
  label: z.string().min(2).max(120),
  value: z.string().min(1).max(120),
});

export const unlockRequirementSchema = z.object({
  requiresItem: itemSlugSchema,
  answerSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'must be sha256 hex'),
});

export const endingConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ALL_OF'),
    taskIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('ANY_OF'),
    taskIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('SCORE_GTE'),
    minScore: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ITEM_COLLECTED'),
    slug: itemSlugSchema,
  }),
  z.object({ type: z.literal('TIMEOUT') }),
  z.object({ type: z.literal('DEFAULT') }),
]);

export const endingSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/, 'must be lowercase a-z, 0-9, _, -'),
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(2000),
  condition: endingConditionSchema,
  isDefault: z.boolean(),
  orderIndex: z.number().int().nonnegative().default(0),
});

export const transitionSchema = z.object({
  fromTaskId: z.string().nullable(),
  toTaskId: z.string(),
  label: z.string().max(80).optional().nullable(),
  condition: z.record(z.unknown()).optional().nullable(),
  orderIndex: z.number().int().nonnegative().default(0),
});

export const unlockConfigSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('QR'), expectedHash: z.string() }),
  z.object({
    method: z.literal('GPS'),
    latitude: z.number(),
    longitude: z.number(),
    radiusMeters: z.number().positive(),
  }),
  z.object({ method: z.literal('NONE') }),
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
  unlockMethod: z.enum(['QR', 'GPS', 'NONE']),
  orderIndex: z.number().int().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  unlockConfig: unlockConfigSchema,
  verifyConfig: verifyConfigSchema,
  maxPoints: z.number().int().positive(),
  timeLimitSec: z.number().int().positive().optional(),
  revealsItem: revealedItemSchema.optional().nullable(),
  unlockRequirements: unlockRequirementSchema.optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const submissionSchema = z.object({
  answer: z.string().optional(),
  scannedCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  mediaUrl: z.string().url().optional(),
});

// ── Blueprint schemas (AI-generated games) ─────────────────────────────────

export const blueprintInputSchema = z.object({
  city: z.string().min(2).max(100),
  theme: z.string().min(3).max(280),
  flowType: gameFlowTypeSchema,
  taskCount: z.number().int().min(3).max(20),
  durationMinutes: z.number().int().min(15).max(360),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  language: z.string().min(2).max(8).default('pl'),
  audience: z.string().max(120).optional(),
  tone: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  allowedTaskTypes: z.array(z.nativeEnum(TaskType)).min(1).max(8).optional(),
  mixedComponentTypes: z
    .array(
      z
        .nativeEnum(TaskType)
        .refine((t) => t !== TaskType.MIXED, 'MIXED cannot be its own component'),
    )
    .min(2)
    .max(7)
    .optional(),
  endingCount: z.number().int().min(2).max(6).optional(),
  useWebSearch: z.boolean().optional(),
});

export const blueprintHintSchema = z.object({
  content: z.string().min(3).max(400),
  pointPenalty: z.number().int().nonnegative().max(100),
});

export const blueprintUnlockRequirementSchema = z.object({
  requiresItem: itemSlugSchema,
  expectedAnswer: z.string().min(1).max(120),
});

export const blueprintMixedStepSchema = z.object({
  type: z
    .nativeEnum(TaskType)
    .refine((t) => t !== TaskType.MIXED, 'MIXED cannot be a step inside MIXED'),
  expectedAnswer: z.string().min(1).max(200).optional(),
  aiPrompt: z.string().min(10).max(2000).optional(),
  aiThreshold: z.number().min(0).max(1).optional(),
  radiusMeters: z.number().positive().max(2000).optional(),
  cipherHint: z.string().max(500).optional(),
});

export const blueprintTaskSchema = z.object({
  index: z.number().int().min(1),
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  type: z.nativeEnum(TaskType),
  unlockMethod: z.nativeEnum(UnlockMethod),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().positive().max(2000).optional(),
  expectedAnswer: z.string().min(1).max(200).optional(),
  aiPrompt: z.string().min(10).max(2000).optional(),
  aiThreshold: z.number().min(0).max(1).optional(),
  caseSensitive: z.boolean().optional(),
  cipherHint: z.string().max(500).optional(),
  maxPoints: z.number().int().positive().max(1000),
  timeLimitSec: z.number().int().positive().max(7200).optional(),
  storyContext: z
    .union([
      z.string().max(2000),
      z.object({
        characterName: z.string().max(120).optional(),
        locationIntro: z.string().max(800).optional(),
        taskNarrative: z.string().max(2000).optional(),
        clueRevealed: z.string().max(800).optional(),
      }),
    ])
    .optional(),
  hints: z.array(blueprintHintSchema).max(5),
  revealsItem: revealedItemSchema.optional(),
  unlockRequirements: blueprintUnlockRequirementSchema.optional(),
  mixedSteps: z.array(blueprintMixedStepSchema).min(2).max(5).optional(),
});

export const blueprintTransitionSchema = z.object({
  fromTaskIndex: z.number().int().min(1).nullable(),
  toTaskIndex: z.number().int().min(1),
  label: z.string().max(80).optional(),
});

export const blueprintEndingConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ALL_OF'),
    taskIndices: z.array(z.number().int().min(1)).min(1),
  }),
  z.object({
    type: z.literal('ANY_OF'),
    taskIndices: z.array(z.number().int().min(1)).min(1),
  }),
  z.object({
    type: z.literal('SCORE_GTE'),
    minScore: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ITEM_COLLECTED'),
    slug: itemSlugSchema,
  }),
  z.object({ type: z.literal('TIMEOUT') }),
  z.object({ type: z.literal('DEFAULT') }),
]);

export const blueprintEndingSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/, 'must be lowercase a-z, 0-9, _, -'),
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(2000),
  condition: blueprintEndingConditionSchema,
  isDefault: z.boolean(),
});

export const gameBlueprintSchema = z
  .object({
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(2000),
    city: z.string().min(2).max(100),
    flowType: gameFlowTypeSchema,
    language: z.string().min(2).max(8),
    theme: z.string().min(3).max(280),
    prologue: z.string().max(2000).optional(),
    tasks: z.array(blueprintTaskSchema).min(3).max(20),
    transitions: z.array(blueprintTransitionSchema).min(1),
    endings: z.array(blueprintEndingSchema).min(1).max(6),
  })
  .superRefine((bp, ctx) => {
    const indices = new Set(bp.tasks.map((t) => t.index));
    if (indices.size !== bp.tasks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'task indices must be unique',
        path: ['tasks'],
      });
    }

    const referencedSources = new Set<string>();
    for (const t of bp.tasks) {
      if (t.revealsItem) referencedSources.add(t.revealsItem.slug);
    }
    for (const t of bp.tasks) {
      if (
        t.unlockRequirements &&
        !referencedSources.has(t.unlockRequirements.requiresItem)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `task ${t.index} requires item "${t.unlockRequirements.requiresItem}" but no task reveals it`,
          path: ['tasks'],
        });
      }
      if (t.type === TaskType.MIXED) {
        if (!t.mixedSteps || t.mixedSteps.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `MIXED task ${t.index} requires at least 2 mixedSteps`,
            path: ['tasks'],
          });
        }
      }
    }

    for (const tr of bp.transitions) {
      if (tr.fromTaskIndex !== null && !indices.has(tr.fromTaskIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `transition.fromTaskIndex ${tr.fromTaskIndex} not found`,
          path: ['transitions'],
        });
      }
      if (!indices.has(tr.toTaskIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `transition.toTaskIndex ${tr.toTaskIndex} not found`,
          path: ['transitions'],
        });
      }
    }

    const reachable = new Set<number>();
    const fromStart = bp.transitions
      .filter((t) => t.fromTaskIndex === null)
      .map((t) => t.toTaskIndex);
    const queue = [...fromStart];
    while (queue.length) {
      const i = queue.shift();
      if (i === undefined || reachable.has(i)) continue;
      reachable.add(i);
      for (const tr of bp.transitions) {
        if (tr.fromTaskIndex === i && !reachable.has(tr.toTaskIndex)) {
          queue.push(tr.toTaskIndex);
        }
      }
    }
    if (bp.flowType !== 'OPEN_WORLD') {
      for (const t of bp.tasks) {
        if (!reachable.has(t.index)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `task ${t.index} is unreachable from start`,
            path: ['tasks'],
          });
        }
      }
    }

    const defaultCount = bp.endings.filter((e) => e.isDefault).length;
    if (defaultCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `exactly one ending must have isDefault=true (got ${defaultCount})`,
        path: ['endings'],
      });
    }

    const slugs = new Set<string>();
    for (const e of bp.endings) {
      if (slugs.has(e.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate ending slug "${e.slug}"`,
          path: ['endings'],
        });
      }
      slugs.add(e.slug);
      const c = e.condition;
      if (
        (c.type === 'ALL_OF' || c.type === 'ANY_OF') &&
        c.taskIndices.some((i) => !indices.has(i))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ending "${e.slug}" references unknown task indices`,
          path: ['endings'],
        });
      }
      if (
        c.type === 'ITEM_COLLECTED' &&
        !referencedSources.has(c.slug)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ending "${e.slug}" requires item "${c.slug}" but no task reveals it`,
          path: ['endings'],
        });
      }
    }
  });

export type GameBlueprintParsed = z.infer<typeof gameBlueprintSchema>;
