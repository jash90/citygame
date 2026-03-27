const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

let refreshPromise: Promise<boolean> | null = null;

export async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const json = await res.json();
    const data = json.data ?? json;

    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      // Update cached role from new token payload
      try {
        const parts = data.accessToken.split('.');
        if (parts.length === 3) {
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (base64.length % 4) base64 += '=';
          const payload = JSON.parse(atob(base64));
          if (payload?.role) {
            localStorage.setItem('userRole', payload.role);
          }
        }
      } catch {
        // Ignore parse errors — token is still saved
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function handleUnauthorized(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
  throw new Error('Unauthorized');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (response.status === 401 && !_isRetry) {
    // Deduplicate concurrent refresh attempts
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;

    if (refreshed) {
      return request<T>(path, options, true);
    }

    handleUnauthorized();
  }

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

import type { Game, Task, GameSession, UserListItem, UserRole, SystemInfo } from '@citygame/shared';

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

  /** GET /api/admin/system/info — system information */
  getSystemInfo(): Promise<SystemInfo> {
    return api.get('/api/admin/system/info');
  },
};
