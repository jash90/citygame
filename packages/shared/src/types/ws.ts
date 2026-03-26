export enum WsEvent {
  JOIN_GAME = 'join-game',
  LEAVE_GAME = 'leave-game',
  LOCATION_UPDATE = 'location:update',
  RANKING_UPDATE = 'ranking:update',
  PLAYER_COMPLETED_TASK = 'player-completed-task',
  AI_RESULT = 'ai:result',
  GAME_STATUS = 'game:status',
}

export interface WsLocationUpdate {
  latitude: number;
  longitude: number;
}

export interface WsRankingUpdate {
  gameId: string;
  entries: {
    userId: string;
    displayName: string;
    totalPoints: number;
    rank: number;
  }[];
}

export interface WsPlayerCompletedTask {
  gameId: string;
  userId: string;
  displayName: string;
  taskId: string;
  taskTitle: string;
  pointsAwarded: number;
}

export interface WsAiResult {
  attemptId: string;
  status: string;
  score?: number;
  feedback?: string;
}
