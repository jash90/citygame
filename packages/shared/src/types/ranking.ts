export interface RankingEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  totalPoints: number;
  completedTasks: number;
  rank: number;
}

export interface RankingUpdate {
  gameId: string;
  entries: RankingEntry[];
  updatedAt: string;
}
