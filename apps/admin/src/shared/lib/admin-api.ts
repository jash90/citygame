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

  /** GET /api/admin/games/:id/runs/:runId — single run metadata */
  getRunDetail(
    gameId: string,
    runId: string,
  ): Promise<GameRun & { _count: { sessions: number } }> {
    return api.get(`/api/admin/games/${gameId}/runs/${runId}`);
  },

  /** GET /api/admin/games/:id/runs/:runId/baseline — averages from earlier ENDED runs */
  getRunBaseline(
    gameId: string,
    runId: string,
  ): Promise<{ avgTotalPlayers: number; avgCompletionRate: number; runsCount: number }> {
    return api.get(`/api/admin/games/${gameId}/runs/${runId}/baseline`);
  },

  /** GET /api/admin/games/:id/runs/:runId/comparison — timeline + per-task prior averages */
  getRunComparison(
    gameId: string,
    runId: string,
  ): Promise<{
    runs: {
      runId: string;
      runNumber: number;
      status: 'ACTIVE' | 'ENDED';
      startedAt: string;
      endedAt: string | null;
      totalPlayers: number;
      completionRate: number;
      avgScore: number;
      avgTimeMinutes: number;
    }[];
    priorTaskStats: {
      taskId: string;
      taskTitle: string;
      priorCompletionRate: number;
      priorAvgAttempts: number;
      priorRunsCount: number;
    }[];
    priorRunsCount: number;
  }> {
    return api.get(`/api/admin/games/${gameId}/runs/${runId}/comparison`);
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

  // ─── Mentor management ────────────────────────────────────────────────────

  /** GET /api/admin/games/:id/mentors — list mentors assigned to a game */
  getGameMentors(gameId: string): Promise<{
    id: string;
    assignedAt: string;
    mentor: { id: string; displayName: string; email: string; avatarUrl?: string | null };
  }[]> {
    return api.get(`/api/admin/games/${gameId}/mentors`);
  },

  /** POST /api/admin/games/:id/mentors — assign a mentor */
  assignMentor(gameId: string, mentorId: string): Promise<unknown> {
    return api.post(`/api/admin/games/${gameId}/mentors`, { mentorId });
  },

  /** DELETE /api/admin/games/:id/mentors/:userId — unassign a mentor */
  unassignMentor(gameId: string, mentorId: string): Promise<unknown> {
    return api.delete(`/api/admin/games/${gameId}/mentors/${mentorId}`);
  },
};

// ─── Mentor (mentor-role) API ────────────────────────────────────────────────

export const mentorApi = {
  /** GET /api/mentor/games — games this mentor is assigned to */
  getMyGames(): Promise<{
    id: string;
    title: string;
    city: string;
    status: string;
    coverImageUrl: string | null;
    assignedAt: string;
    pendingCount: number;
  }[]> {
    return api.get('/api/mentor/games');
  },

  /** GET /api/mentor/games/:id/pending — pending attempts to review */
  getPendingAttempts(gameId: string): Promise<{
    id: string;
    userId: string;
    taskId: string;
    submission: Record<string, unknown>;
    createdAt: string;
    user: { id: string; displayName: string; email: string };
    task: {
      id: string;
      title: string;
      description: string;
      type: string;
      maxPoints: number;
      verifyConfig: Record<string, unknown>;
      orderIndex: number;
    };
  }[]> {
    return api.get(`/api/mentor/games/${gameId}/pending`);
  },

  /** POST /api/mentor/attempts/:attemptId/review — score 0-100 + feedback */
  reviewAttempt(
    attemptId: string,
    body: { score: number; feedback: string },
  ): Promise<unknown> {
    return api.post(`/api/mentor/attempts/${attemptId}/review`, body);
  },
};
