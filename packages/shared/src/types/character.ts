import { z } from 'zod';

export const characterRoleFunctionSchema = z.enum([
  'QUEST_GIVER',
  'MENTOR',
  'ANTAGONIST_PROXY',
  'WITNESS',
  'GATEKEEPER',
  'MIRROR',
  'RED_HERRING',
  'UNKNOWN',
]);

export type CharacterRoleFunction = z.infer<typeof characterRoleFunctionSchema>;

export const taskRoleInArcSchema = z.enum([
  'INTRODUCTION',
  'DEEPENING',
  'TWIST',
  'CLIMAX',
]);

export type TaskRoleInArc = z.infer<typeof taskRoleInArcSchema>;

export const storyModeSchema = z.enum(['NONE', 'FLAVOR', 'FULL_NARRATIVE']);
export type StoryMode = z.infer<typeof storyModeSchema>;

export const taskListModeSchema = z.enum(['FLAT', 'GROUPED_BY_NPC']);
export type TaskListMode = z.infer<typeof taskListModeSchema>;

export const characterSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  name: z.string().min(2).max(80),
  archetype: z.string().min(5).max(120),
  roleFunction: characterRoleFunctionSchema,
  voiceTrait: z.string().min(20).max(300),
  importance: z.number().int().min(1).max(5),
  avatarUrl: z.string().url().nullable(),
  era: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Character = z.infer<typeof characterSchema>;

export const characterCreateSchema = characterSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CharacterCreate = z.infer<typeof characterCreateSchema>;

export const characterUpdateSchema = characterCreateSchema.partial().omit({
  gameId: true,
});

export type CharacterUpdate = z.infer<typeof characterUpdateSchema>;
