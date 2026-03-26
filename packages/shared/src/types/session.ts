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

export interface GameSession {
  id: string;
  gameId: string;
  userId: string;
  status: SessionStatus;
  totalPoints: number;
  startedAt: string;
  completedAt?: string;
  currentTaskId?: string;
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
