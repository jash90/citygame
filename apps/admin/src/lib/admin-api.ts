import { api } from './api';
import type {
  Game,
  GameRun,
  Task,
  GameSession,
  UserListItem,
  UserRole,
  SystemInfo,
  GameStats as SharedGameStats,
} from '@citygame/shared';

export type GameStats = SharedGameStats;

export interface GenerateTaskContentParams {
  type: 'description' | 'hints' | 'prompt';
  title?: string;
  description?: string;
  taskType?: string;
}

export interface GenerateTaskContentResult {
  content: string;
}

export const adminApi = {
  /** GET /api/admin/games/:id — game with full task details */
  getGame(id: string): Promise<Game & { tasks: Task[] }> {
    return api.get(`/api/admin/games/${id}`);
  },

  /** GET /api/admin/games/:gameId/sessions — sessions with player info */
  getGameSessions(
    gameId: string,
    runId?: string,
  ): Promise<{ items: GameSession[]; total: number; page: number; limit: number; totalPages: number }> {
    const qs = runId ? `?runId=${runId}` : '';
    return api.get(`/api/admin/games/${gameId}/sessions${qs}`);
  },

  /** GET /api/admin/games/:gameId/stats — aggregated statistics */
  getGameStats(gameId: string, runId?: string): Promise<GameStats> {
    const qs = runId ? `?runId=${runId}` : '';
    return api.get(`/api/admin/games/${gameId}/stats${qs}`);
  },

  /** POST /api/admin/games/:gameId/generate-task-content — AI generation */
  generateTaskContent(
    gameId: string,
    params: GenerateTaskContentParams,
  ): Promise<GenerateTaskContentResult> {
    return api.post(`/api/admin/games/${gameId}/generate-task-content`, params);
  },

  /** GET /api/admin/users — paginated user list */
  getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<{
    items: UserListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.role) qs.set('role', params.role);
    return api.get(`/api/admin/users?${qs.toString()}`);
  },

  /** PATCH /api/admin/users/:id/role — change user role */
  updateUserRole(userId: string, role: UserRole): Promise<UserListItem> {
    return api.patch(`/api/admin/users/${userId}/role`, { role });
  },

  /** GET /api/admin/games/:id/run-activity — historical activity for active run */
  getRunActivity(
    gameId: string,
    runId?: string,
  ): Promise<{
    id: string;
    timestamp: string;
    playerName: string;
    action: 'game_joined' | 'task_completed' | 'hint_used' | 'game_completed';
    details: string;
    points?: number;
  }[]> {
    const qs = runId ? `?runId=${runId}` : '';
    return api.get(`/api/admin/games/${gameId}/run-activity${qs}`);
  },

  /** GET /api/admin/games/:id/run-completions — per-task completions for active run */
  getRunCompletions(
    gameId: string,
    runId?: string,
  ): Promise<{
    runId: string | null;
    completions: { taskId: string; count: number }[];
  }> {
    const qs = runId ? `?runId=${runId}` : '';
    return api.get(`/api/admin/games/${gameId}/run-completions${qs}`);
  },

  /** POST /api/admin/games/:id/start-run — start a new game run */
  startRun(gameId: string): Promise<GameRun> {
    return api.post(`/api/admin/games/${gameId}/start-run`, {});
  },

  /** PATCH /api/admin/games/:id/end-run — end the active game run */
  endRun(gameId: string): Promise<GameRun> {
    return api.patch(`/api/admin/games/${gameId}/end-run`, {});
  },

  /** GET /api/admin/games/:id/runs — run history */
  getGameRuns(gameId: string): Promise<(GameRun & { _count: { sessions: number } })[]> {
    return api.get(`/api/admin/games/${gameId}/runs`);
  },

  /** GET /api/admin/running-games — games with active runs */
  getRunningGames(): Promise<Game[]> {
    return api.get('/api/admin/running-games');
  },

  /** GET /api/admin/system/info — system information */
  getSystemInfo(): Promise<SystemInfo> {
    return api.get('/api/admin/system/info');
  },

  /** GET /api/admin/games/:id/analytics/activity — player activity time-series */
  getPlayerActivity(
    gameId: string,
    days: number,
    runId?: string,
  ): Promise<{ date: string; players: number; completions: number }[]> {
    const params = new URLSearchParams({ days: String(days) });
    if (runId) params.set('runId', runId);
    return api.get(`/api/admin/games/${gameId}/analytics/activity?${params}`);
  },

  /** GET /api/admin/games/:id/analytics/task-difficulty — avg attempts per task */
  getTaskDifficulty(
    gameId: string,
    runId?: string,
  ): Promise<{ taskId: string; taskTitle: string; avgAttempts: number; avgTimeSec: number }[]> {
    const qs = runId ? `?runId=${runId}` : '';
    return api.get(`/api/admin/games/${gameId}/analytics/task-difficulty${qs}`);
  },

  /** GET /api/admin/games/:id/analytics/ai-verification — AI evaluation stats */
  getAiVerificationStats(
    gameId: string,
    runId?: string,
  ): Promise<{ taskName: string; evaluations: number; avgScore: number; errorRate: number }[]> {
    const qs = runId ? `?runId=${runId}` : '';
    return api.get(`/api/admin/games/${gameId}/analytics/ai-verification${qs}`);
  },
};
