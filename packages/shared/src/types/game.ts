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

export interface GameSettings {
  maxPlayers?: number;
  timeLimitMinutes?: number;
  allowLateJoin?: boolean;
  allowHints?: boolean;
  teamMode?: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
}

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
