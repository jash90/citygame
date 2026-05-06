export enum GameStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum RunStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}

/**
 * How tasks compose into a playable game.
 * - LINEAR: tasks are ordered, players progress one-by-one (the legacy default).
 * - BRANCHING: directed graph of transitions; choices may lead to different endings.
 * - OPEN_WORLD: every task is reachable from start; ending evaluated on completion.
 * - MIXED: hub-and-spoke; central tasks gate spokes that must return to a hub.
 */
export enum GameFlowType {
  LINEAR = 'LINEAR',
  BRANCHING = 'BRANCHING',
  OPEN_WORLD = 'OPEN_WORLD',
  MIXED = 'MIXED',
}

export interface GameRun {
  id: string;
  gameId: string;
  runNumber: number;
  status: RunStatus;
  startedAt: string;
  endsAt?: string;
  endedAt?: string;
}

export interface NarrativeSettings {
  isNarrative?: boolean;
  theme?: string;
  prologue?: string;
  /**
   * @deprecated Source of truth is now the default `GameEnding` row created in
   * `from-blueprint`. Reads should fall back to this field only for legacy
   * games that have no ending materialised.
   */
  epilogue?: string;
}

export interface GameSettings {
  maxPlayers?: number;
  timeLimitMinutes?: number;
  allowLateJoin?: boolean;
  allowHints?: boolean;
  teamMode?: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
  /**
   * Distance (meters) within which an upcoming task pin appears on the map
   * once the previous task has been completed. The first task is always
   * visible. Defaults to DEFAULT_PIN_REVEAL_DISTANCE_METERS when unset.
   */
  pinRevealDistanceMeters?: number;
  narrative?: NarrativeSettings;
}

export const DEFAULT_PIN_REVEAL_DISTANCE_METERS = 100;
export const MIN_PIN_REVEAL_DISTANCE_METERS = 20;
export const MAX_PIN_REVEAL_DISTANCE_METERS = 1000;

export type EndingCondition =
  | { type: 'ALL_OF'; taskIds: string[] }
  | { type: 'ANY_OF'; taskIds: string[] }
  | { type: 'SCORE_GTE'; minScore: number }
  | { type: 'ITEM_COLLECTED'; slug: string }
  | { type: 'TIMEOUT' }
  | { type: 'DEFAULT' };

export interface GameEnding {
  id: string;
  gameId: string;
  slug: string;
  title: string;
  description: string;
  condition: EndingCondition;
  isDefault: boolean;
  orderIndex: number;
}

export interface TaskTransition {
  id: string;
  gameId: string;
  fromTaskId: string | null;
  toTaskId: string;
  label?: string | null;
  condition?: Record<string, unknown> | null;
  orderIndex: number;
}

export interface Game {
  id: string;
  title: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  status: GameStatus;
  flowType: GameFlowType;
  settings: GameSettings;
  creatorId: string;
  currentRun: number;
  activeRun?: GameRun | null;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  playerCount?: number;
  endings?: GameEnding[];
  transitions?: TaskTransition[];
}

export interface CreateGameDto {
  title: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  flowType?: GameFlowType;
  settings?: GameSettings;
}

export interface UpdateGameDto extends Partial<CreateGameDto> {}
