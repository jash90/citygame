const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function handleUnauthorized(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  }
  throw new Error('Unauthorized');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Błąd serwera' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();
  // Backend wraps responses in { data, message } via TransformInterceptor
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' });
  },

  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
};

// ─── Admin-specific helpers ────────────────────────────────────────────────

import type { Game, Task, GameSession } from '@citygame/shared';

export interface GameStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalTaskCompletions: number;
  averageCompletionTimeSec?: number;
}

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

  /** GET /api/admin/games/:gameId/sessions — all sessions with player info */
  getGameSessions(gameId: string): Promise<GameSession[]> {
    return api.get(`/api/admin/games/${gameId}/sessions`);
  },

  /** GET /api/admin/games/:gameId/stats — aggregated statistics */
  getGameStats(gameId: string): Promise<GameStats> {
    return api.get(`/api/admin/games/${gameId}/stats`);
  },

  /** POST /api/admin/games/:gameId/generate-task-content — AI generation */
  generateTaskContent(
    gameId: string,
    params: GenerateTaskContentParams,
  ): Promise<GenerateTaskContentResult> {
    return api.post(`/api/admin/games/${gameId}/generate-task-content`, params);
  },
};
