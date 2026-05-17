export type AnalyticsPeriod = '7d' | '30d' | 'all';

export interface PlayerActivityDataPoint {
  date: string;
  players: number;
  completions: number;
}

export interface TaskFunnelDataPoint {
  taskTitle: string;
  completions: number;
  totalPlayers: number;
  /** Optional: prior runs' average completion percentage for the same task. */
  priorCompletionRate?: number;
}

export interface ScoreDistributionDataPoint {
  range: string;
  count: number;
}

export interface TaskDifficultyDataPoint {
  taskTitle: string;
  avgAttempts: number;
  avgTimeSec: number;
  /** Optional: prior runs' average attempts for the same task. */
  priorAvgAttempts?: number;
}

export interface RunTimelinePoint {
  runId: string;
  runNumber: number;
  isCurrent: boolean;
  totalPlayers: number;
  completionRate: number;
  avgScore: number;
  avgTimeMinutes: number;
}

export interface TopPlayer {
  rank: number;
  name: string;
  score: number;
  tasksCompleted: number;
  timeMinutes: number;
  lastActive: string;
}

export interface AIVerificationStat {
  taskName: string;
  evaluations: number;
  avgScore: number;
  errorRate: number;
}

export interface AnalyticsData {
  totalPlayers: number;
  completionRate: number;
  averageScore: number;
  averageTimeMinutes: number;
  /** Percentage change vs. baseline. `null` when no baseline is available. */
  playersTrend: number | null;
  completionRateTrend: number | null;

  playerActivity: PlayerActivityDataPoint[];
  taskFunnel: TaskFunnelDataPoint[];
  scoreDistribution: ScoreDistributionDataPoint[];
  taskDifficulty: TaskDifficultyDataPoint[];

  topPlayers: TopPlayer[];
  aiVerificationStats: AIVerificationStat[];
}

export type RunOption = {
  id: string;
  runNumber: number;
  status: string;
  sessionCount: number;
};
