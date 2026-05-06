import type { RevealedItem } from './task';

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
  TIMED_OUT = 'TIMED_OUT',
}

export enum AttemptStatus {
  PENDING = 'PENDING',
  CORRECT = 'CORRECT',
  INCORRECT = 'INCORRECT',
  PARTIAL = 'PARTIAL',
  ERROR = 'ERROR',
}

/**
 * Per-session inventory. Keys are item slugs (`RevealedItem.slug`).
 * Mobile reads it to decide whether a task with `unlockRequirements` is
 * playable. Server merges new entries when a task with `revealsItem` is
 * completed.
 */
export type UnlockedItems = Record<string, RevealedItem>;

export interface GameSession {
  id: string;
  gameId: string;
  userId: string;
  gameRunId: string;
  status: SessionStatus;
  totalPoints: number;
  startedAt: string;
  completedAt?: string;
  currentTaskId?: string;
  unlockedItems?: UnlockedItems;
  endingId?: string | null;
}

export interface TaskAttempt {
  id: string;
  sessionId: string;
  taskId: string;
  userId: string;
  status: AttemptStatus;
  attemptNumber: number;
  submission: Record<string, unknown>;
  aiResult?: AiVerificationResult;
  pointsAwarded: number;
  timeTakenSec?: number;
  createdAt: string;
}

export interface AiVerificationResult {
  score: number;
  feedback: string;
  reasoning?: string;
}
