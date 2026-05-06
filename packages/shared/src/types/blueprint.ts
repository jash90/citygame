import type { GameFlowType, EndingCondition } from './game';
import type { TaskType, UnlockMethod, RevealedItem } from './task';

/**
 * Input the admin sends to the AI blueprint generator. Mirrors the wizard's
 * Step-1 form. Free-form `notes` lets admins steer tone, audience, themes.
 */
export interface BlueprintInput {
  city: string;
  theme: string;
  flowType: GameFlowType;
  taskCount: number;
  durationMinutes: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  language: string;
  audience?: string;
  tone?: string;
  notes?: string;
  /**
   * If provided, the AI is instructed to only emit tasks whose `type` belongs
   * to this set. When omitted or empty the model picks freely from all
   * `TaskType` values.
   */
  allowedTaskTypes?: TaskType[];
  /**
   * For tasks whose `type` is `MIXED`, the AI is told to combine two or more
   * task types from this list as a single multi-step puzzle. Cannot include
   * `MIXED` itself. When omitted the AI picks freely.
   */
  mixedComponentTypes?: TaskType[];
  /**
   * How many endings the AI should produce, applicable only for non-LINEAR
   * flow types (BRANCHING / OPEN_WORLD / MIXED). LINEAR is hard-coded to 1.
   * Range: 2–6. When omitted the AI picks within 2–4 per the prompt.
   */
  endingCount?: number;
  /**
   * When true, the backend appends `:online` to the model name so OpenRouter
   * runs its web-search plugin alongside generation. Useful for picking up
   * real legends, POI names, and coordinates for the requested city. Costs
   * extra tokens for retrieved snippets — defaults to false.
   */
  useWebSearch?: boolean;
}

export interface BlueprintTaskHint {
  content: string;
  pointPenalty: number;
}

/**
 * Plaintext expected answer for a consumer task. The backend hashes it during
 * `from-blueprint` and stores only the hash in `Task.unlockRequirements`.
 */
export interface BlueprintUnlockRequirement {
  requiresItem: string;
  expectedAnswer: string;
}

/**
 * One sub-step inside a MIXED task. Each step is verified independently and
 * the player must clear all of them in order. Mirrors the editor's
 * `MixedStepValues`. The persistence service hashes plaintext fields just
 * like a standalone task of the same type.
 */
export interface BlueprintMixedStep {
  /** A non-MIXED task type. */
  type: Exclude<TaskType, TaskType.MIXED>;
  /** Plaintext for QR_SCAN (sticker text), TEXT_EXACT, and CIPHER (answer). */
  expectedAnswer?: string;
  /** Required for *_AI step types. */
  aiPrompt?: string;
  aiThreshold?: number;
  /** GPS_REACH override; if absent the parent task's location is reused. */
  radiusMeters?: number;
  /** Optional hint shown alongside a CIPHER step. */
  cipherHint?: string;
}

export interface BlueprintTask {
  /** Stable index (1-based) used by the AI to reference tasks across stages. */
  index: number;
  title: string;
  description: string;
  type: TaskType;
  unlockMethod: UnlockMethod;
  latitude: number;
  longitude: number;
  /** Optional radius in meters for GPS unlock or verify. */
  radiusMeters?: number;
  /**
   * Plaintext expected answer for TEXT_EXACT, CIPHER, and QR_SCAN tasks.
   * Hashed during persistence.
   */
  expectedAnswer?: string;
  /** Required for AI-verification task types. */
  aiPrompt?: string;
  aiThreshold?: number;
  caseSensitive?: boolean;
  cipherHint?: string;
  /**
   * Required when `type === 'MIXED'`. Two or more sub-steps that the player
   * must clear in order. Empty / absent for non-MIXED tasks.
   */
  mixedSteps?: BlueprintMixedStep[];
  maxPoints: number;
  timeLimitSec?: number;
  /**
   * Narrative context attached to the task. Either a free-form prose string
   * (legacy) or the structured shape stored in `Task.storyContext` JSON
   * column. The persistence service normalises both into the JSON form.
   */
  storyContext?:
    | string
    | {
        characterName?: string;
        locationIntro?: string;
        taskNarrative?: string;
        clueRevealed?: string;
      };
  hints: BlueprintTaskHint[];
  revealsItem?: RevealedItem;
  unlockRequirements?: BlueprintUnlockRequirement;
}

export interface BlueprintTransition {
  fromTaskIndex: number | null;
  toTaskIndex: number;
  label?: string;
}

export interface BlueprintEnding {
  slug: string;
  title: string;
  description: string;
  /**
   * Variant of `EndingCondition` where `taskIds` carry blueprint indices
   * instead of UUIDs. Resolved into IDs during persistence.
   */
  condition:
    | { type: 'ALL_OF'; taskIndices: number[] }
    | { type: 'ANY_OF'; taskIndices: number[] }
    | { type: 'SCORE_GTE'; minScore: number }
    | { type: 'ITEM_COLLECTED'; slug: string }
    | { type: 'TIMEOUT' }
    | { type: 'DEFAULT' };
  isDefault: boolean;
}

export interface GameBlueprint {
  title: string;
  description: string;
  city: string;
  flowType: GameFlowType;
  language: string;
  theme: string;
  prologue?: string;
  tasks: BlueprintTask[];
  transitions: BlueprintTransition[];
  endings: BlueprintEnding[];
}

/** Stage-by-stage outline produced before the full blueprint hydration. */
export interface BlueprintOutline {
  title: string;
  description: string;
  city: string;
  flowType: GameFlowType;
  theme: string;
  prologue?: string;
  pois: Array<{
    index: number;
    name: string;
    latitude: number;
    longitude: number;
    role: 'START' | 'HUB' | 'PUZZLE' | 'CIPHER_SOURCE' | 'CIPHER_LOCK' | 'FINAL';
    summary: string;
  }>;
  endingHints: Array<{
    slug: string;
    title: string;
    flavour: string;
  }>;
}

export type BlueprintStage = 'outline' | 'tasks' | 'endings' | 'task';

export interface RefineBlueprintRequest {
  stage: BlueprintStage;
  /** When `stage = 'task'`, the index of the task to regenerate (1-based). */
  taskIndex?: number;
  blueprint: GameBlueprint;
  input: BlueprintInput;
}
