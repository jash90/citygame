export enum GameStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum RunStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
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

export interface Game {
  id: string;
  title: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  status: GameStatus;
  settings: GameSettings;
  creatorId: string;
  currentRun: number;
  activeRun?: GameRun | null;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  playerCount?: number;
}

export interface CreateGameDto {
  title: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  settings?: GameSettings;
}

export interface UpdateGameDto extends Partial<CreateGameDto> {}
