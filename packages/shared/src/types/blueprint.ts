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
  /**
   * Narrative mode: NONE = no characters (legacy), FLAVOR = character entities
   * with npcId on tasks, FULL_NARRATIVE = future (secrets, relations, endings resolver).
   */
  storyMode?: 'NONE' | 'FLAVOR' | 'FULL_NARRATIVE';
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
  /**
   * Name of the NPC from the cast that presents this task. Matches a
   * Character entity name. Set by the tasks stage when storyMode is FLAVOR.
   */
  npcName?: string;
  /**
   * Role this task plays in the character's arc.
   */
  taskRoleInArc?: 'INTRODUCTION' | 'DEEPENING' | 'TWIST' | 'CLIMAX';
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

/**
 * Narrative skeleton produced FIRST in the AI pipeline and propagated as
 * authoritative context to outline → tasks → endings. See `storyBibleSchema`
 * in `packages/shared/src/validation` for the full Zod definition; that
 * schema is the source of truth and is exported as `StoryBible` from
 * `@citygame/shared`. Re-declared here as a structural alias so this types
 * file can describe the blueprint without pulling in the full validation
 * module's transitive imports.
 */
export interface BlueprintStoryBible {
  protagonistRole: string;
  questGiver: {
    name: string;
    role: string;
    motivation: string;
    voiceTrait: string;
  };
  antagonist: {
    name: string;
    motivation: string;
    revealMode: 'known_from_start' | 'midpoint' | 'climax_twist';
  } | null;
  macguffin: { name: string; significance: string } | null;
  centralMystery: string;
  toneAnchors: string[];
  thematicMotifs: string[];
  recurringCharacters: Array<{
    id: string;
    name: string;
    role: string;
    voiceTrait: string;
    appearsAtPoiHints: string[];
  }>;
  endingsSkeleton: Array<{
    label: string;
    summary: string;
    requiredCluesPlanted: string[];
  }>;
}

export interface BlueprintCastCharacter {
  name: string;
  archetype: string;
  roleFunction: 'QUEST_GIVER' | 'MENTOR' | 'ANTAGONIST_PROXY' | 'WITNESS' | 'GATEKEEPER' | 'MIRROR' | 'RED_HERRING';
  voiceTrait: string;
  importance: number;
  era?: string | null;
}

export interface BlueprintCast {
  characters: BlueprintCastCharacter[];
}

export interface GameBlueprint {
  title: string;
  description: string;
  city: string;
  flowType: GameFlowType;
  language: string;
  theme: string;
  prologue?: string;
  storyBible?: BlueprintStoryBible;
  cast?: BlueprintCast;
  tasks: BlueprintTask[];
  transitions: BlueprintTransition[];
  endings: BlueprintEnding[];
}

export type BlueprintNarrativeBeat =
  | 'hook'
  | 'rising'
  | 'midpoint'
  | 'complication'
  | 'climax'
  | 'resolution';

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
    /** Position in the dramatic arc — drives voice/intensity in the per-task prompt. */
    narrativeBeat?: BlueprintNarrativeBeat;
    /** Recurring-character IDs from the story bible that appear at this POI. */
    recurringCharacterIds?: string[];
    /** Concrete clues this task must surface so endings have material to reference. */
    plantedClues?: string[];
  }>;
  endingHints: Array<{
    slug: string;
    title: string;
    flavour: string;
  }>;
}

/**
 * Deterministic CIPHER_SOURCE/LOCK pairing computed by the backend's
 * `planCipherChains` on the locked outline. The orchestrator forwards each
 * assignment to the matching `/tasks/single` call so parallel per-POI
 * generations agree on the same slug + value for source ↔ lock pairs.
 */
export interface BlueprintCipherAssignment {
  role: 'CIPHER_SOURCE' | 'CIPHER_LOCK';
  /** Stable slug shared by source.revealsItem.slug and lock.unlockRequirements.requiresItem. */
  slug: string;
  /** What the player will see / type — used as both `revealsItem.value` on the source and `expectedAnswer` on the lock. */
  value: string;
  kind: 'CODE' | 'WORD' | 'SYMBOL' | 'NUMBER';
  label: string;
}

export type BlueprintStage = 'outline' | 'tasks' | 'endings' | 'task';

export interface RefineBlueprintRequest {
  stage: BlueprintStage;
  /** When `stage = 'task'`, the index of the task to regenerate (1-based). */
  taskIndex?: number;
  blueprint: GameBlueprint;
  input: BlueprintInput;
}
