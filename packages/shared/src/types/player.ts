import type { AttemptStatus, TaskType } from './index';

/** Result of unlocking a task via GPS or QR. */
export interface UnlockTaskResult {
  unlocked: boolean;
  message: string;
}

/** Result of requesting a hint for a task. */
export interface HintResult {
  hint: {
    content: string;
    pointPenalty: number;
  };
}

/** A single task submission — discriminated by content. */
export type TaskSubmission =
  | { scannedCode: string }
  | { latitude: number; longitude: number }
  | { answer: string }
  | { imageUrl: string }
  | { transcription: string };

/** Presigned upload URL result from the storage API. */
export interface PresignResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

/** Active session response for session restoration. */
export interface ActiveSessionResponse {
  gameId: string;
  sessionId: string;
  gameRunId: string;
}

/** A single run answer entry for the post-game review screen. */
export interface RunAnswerEntry {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  taskType: TaskType;
  maxPoints: number;
  status: AttemptStatus;
  pointsAwarded: number;
  submission: Record<string, unknown>;
  aiResult?: unknown;
  createdAt: string;
}

/** Full run answers response for the post-game review. */
export interface RunAnswersResponse {
  session: {
    id: string;
    status: string;
    totalPoints: number;
    startedAt: string;
    completedAt?: string;
  };
  attempts: RunAnswerEntry[];
}

/** User profile with game statistics. */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  stats: {
    gamesPlayed: number;
    totalPoints: number;
    completedTasks: number;
    rank: number;
  };
}

/** Admin-facing aggregated game statistics. */
export interface GameStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalAttempts: number;
  avgCompletionRate: number;
  taskCompletionRates: {
    taskId: string;
    title: string;
    completedCount: number;
    totalAttempts: number;
  }[];
}
