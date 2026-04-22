import type { TaskType as SharedTaskType } from '@citygame/shared';

// ── Backend raw types (what the API returns) ─────────────────────────────────

export interface BackendActiveRun {
  id: string;
  runNumber: number;
  status: string;
  startedAt: string;
  endsAt?: string | null;
}

export interface BackendGame {
  id: string;
  title: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  settings: {
    timeLimitMinutes?: number;
    pinRevealDistanceMeters?: number;
    [key: string]: unknown;
  };
  currentRun: number;
  activeRun?: BackendActiveRun | null;
  taskCount: number;
  playerCount: number;
  tasks?: BackendTask[];
  [key: string]: unknown;
}

export interface BackendTask {
  id: string;
  title: string;
  description: string;
  type: SharedTaskType;
  maxPoints: number;
  orderIndex: number;
  unlockMethod: string;
  latitude: number;
  longitude: number;
  unlockConfig: Record<string, unknown>;
  timeLimitSec?: number | null;
  storyContext?: string | null;
  _count?: { hints: number };
  [key: string]: unknown;
}

// ── Mobile view types (what the app uses) ────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export type TaskType =
  | 'QR_SCAN'
  | 'GPS_REACH'
  | 'PHOTO_AI'
  | 'AUDIO_AI'
  | 'TEXT_EXACT'
  | 'TEXT_AI'
  | 'CIPHER'
  | 'MIXED';

export type TaskStatus = 'locked' | 'available' | 'completed' | 'failed';

export type AttemptStatus = 'PENDING' | 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'ERROR';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  points: number;
  status: TaskStatus;
  order: number;
  timeLimitSec?: number;
  requiresUnlock?: boolean;
  unlockMethod?: 'GPS' | 'QR' | 'NONE';
  storyContext?: string;
  hintCount: number;
  location?: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
}

export interface NarrativeSettings {
  isNarrative?: boolean;
  theme?: string;
  prologue?: string;
  epilogue?: string;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  taskCount: number;
  duration: number;
  currentRun: number;
  endsAt?: string;
  activeRunId?: string;
  isRunning?: boolean;
  /** Distance (meters) within which an upcoming task pin is revealed on the map. */
  pinRevealDistanceMeters?: number;
  narrative?: NarrativeSettings;
  tasks?: Task[];
}

export interface GameSession {
  id: string;
  gameId: string;
  userId: string;
  gameRunId: string;
  status: string;
  totalPoints: number;
  currentTaskId: string | null;
  startedAt?: string;
}

export interface ProgressAttempt {
  taskId: string;
  pointsAwarded: number;
  createdAt: string;
}

export interface GameProgress {
  session: GameSession & {
    attempts?: ProgressAttempt[];
    hintUsages?: {
      hintId: string;
      usedAt: string;
      hint: { taskId: string; content: string; pointPenalty: number };
    }[];
  };
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
  gameEnded?: boolean;
}

export interface TaskAttempt {
  status: AttemptStatus;
  pointsAwarded: number;
  aiResult?: unknown;
}

export interface UnlockTaskPayload {
  [key: string]: unknown;
}

export interface RankEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  totalPoints: number;
  completedTasks: number;
}

/** @deprecated Use RankEntry instead */
export type RankingEntry = RankEntry;
