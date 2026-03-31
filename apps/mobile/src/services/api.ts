import { API_URL, SECURE_STORE_KEYS } from '@/lib/constants';
import * as SecureStore from 'expo-secure-store';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiError {
  message: string;
  statusCode: number;
}

class ApiClient {
  private baseUrl: string;
  private onUnauthorized?: () => void;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler;
  }

  private async getAuthToken(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;
    const token = await this.getAuthToken();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error('Nieautoryzowany dostęp. Zaloguj się ponownie.');
    }

    if (!response.ok) {
      let errorMessage = `Błąd serwera: ${response.status}`;
      try {
        const errorData = (await response.json()) as ApiError;
        errorMessage = errorData.message ?? errorMessage;
      } catch {
        // ignore JSON parse errors on error responses
      }
      throw new Error(errorMessage);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const json = await response.json();
    // Backend wraps responses in { data, message } via TransformInterceptor
    if (json != null && typeof json === 'object' && 'data' in json) {
      return json.data as T;
    }
    return json as T;
  }

  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: 'GET', headers });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_URL);

// Auth endpoints
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ accessToken: string; refreshToken: string; user: User }>(
      '/auth/login',
      { email, password },
    ),
  register: (email: string, password: string, displayName: string) =>
    apiClient.post<{ accessToken: string; refreshToken: string; user: User }>(
      '/auth/register',
      { email, password, displayName },
    ),
  logout: () => apiClient.post<void>('/auth/logout'),
  me: () => apiClient.get<User>('/auth/me'),
};

// ── Backend → Mobile mappers ─────────────────────────────────────────────────

interface BackendGame {
  id: string;
  title: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  settings: { timeLimitMinutes?: number; [key: string]: unknown };
  taskCount: number;
  playerCount: number;
  tasks?: BackendTask[];
  [key: string]: unknown;
}

interface BackendTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  maxPoints: number;
  orderIndex: number;
  unlockMethod: string;
  latitude: number;
  longitude: number;
  unlockConfig: Record<string, unknown>;
  timeLimitSec?: number | null;
  storyContext?: string | null;
  _count?: { hints: number };
  [key: string]: unknown;
}

function mapGame(bg: BackendGame): Game {
  return {
    id: bg.id,
    name: bg.title,
    description: bg.description,
    city: bg.city,
    coverImageUrl: bg.coverImageUrl,
    taskCount: bg.taskCount,
    duration: bg.settings?.timeLimitMinutes ?? 0,
    narrative: bg.settings?.narrative as NarrativeSettings | undefined,
    tasks: bg.tasks?.map(mapTask),
  };
}

function mapTask(bt: BackendTask): Task {
  return {
    id: bt.id,
    title: bt.title,
    description: bt.description,
    type: bt.type,
    points: bt.maxPoints,
    status: 'available',
    order: bt.orderIndex,
    timeLimitSec: bt.timeLimitSec ?? undefined,
    requiresUnlock: bt.unlockMethod === 'GPS' || bt.unlockMethod === 'QR',
    unlockMethod: (bt.unlockMethod as 'GPS' | 'QR' | 'NONE') ?? 'NONE',
    storyContext: bt.storyContext ?? undefined,
    hintCount: bt._count?.hints ?? 0,
    location: {
      lat: bt.latitude,
      lng: bt.longitude,
      radiusMeters: (bt.unlockConfig?.radiusMeters as number) ?? 50,
    },
  };
}

// Games endpoints — all paths match /api/games/:id/* backend routes
export const gamesApi = {
  list: async (): Promise<Game[]> => {
    const res = await apiClient.get<{ items: BackendGame[] }>('/games');
    return (res.items ?? []).map(mapGame);
  },
  get: async (id: string): Promise<Game> => {
    const bg = await apiClient.get<BackendGame>(`/games/${id}`);
    return mapGame(bg);
  },
  start: (gameId: string) =>
    apiClient.post<GameSession>(`/games/${gameId}/start`),
  progress: (gameId: string) =>
    apiClient.get<GameProgress>(`/games/${gameId}/progress`),
  unlockTask: (gameId: string, taskId: string, data?: UnlockTaskPayload) =>
    apiClient.post<UnlockTaskResult>(`/games/${gameId}/tasks/${taskId}/unlock`, { unlockData: data ?? {} }),
  submitTask: (gameId: string, taskId: string, submission: TaskSubmission) =>
    apiClient.post<TaskAttempt>(`/games/${gameId}/tasks/${taskId}/submit`, { submission }),
  useHint: (gameId: string, taskId: string) =>
    apiClient.post<HintResult>(`/games/${gameId}/tasks/${taskId}/hint`),
  ranking: (gameId: string) =>
    apiClient.get<RankEntry[]>(`/games/${gameId}/ranking`),
};

// Storage endpoints
export const storageApi = {
  presign: (contentType: string, filename: string) =>
    apiClient.post<PresignResult>('/storage/presign', { contentType, filename }),
};

// Profile endpoints
export const profileApi = {
  get: () => apiClient.get<UserProfile>('/profile'),
  update: (data: Partial<UserProfile>) =>
    apiClient.patch<UserProfile>('/profile', data),
};

// --- Types ---

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface UserProfile extends User {
  stats: {
    gamesPlayed: number;
    totalPoints: number;
    completedTasks: number;
    rank: number;
  };
}

// TaskType enum values matching backend
export type TaskType =
  | 'QR_SCAN'
  | 'GPS_REACH'
  | 'PHOTO_AI'
  | 'AUDIO_AI'
  | 'TEXT_EXACT'
  | 'TEXT_AI'
  | 'CIPHER'
  | 'MIXED';

export type TaskStatus = 'locked' | 'available' | 'completed' | 'failed';

export type AttemptStatus = 'PENDING' | 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'ERROR';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  points: number;
  status: TaskStatus;
  order: number;
  timeLimitSec?: number;
  requiresUnlock?: boolean;
  unlockMethod?: 'GPS' | 'QR' | 'NONE';
  storyContext?: string;
  hintCount: number;
  location?: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
}

export interface NarrativeSettings {
  isNarrative?: boolean;
  theme?: string;
  prologue?: string;
  epilogue?: string;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  city: string;
  coverImageUrl?: string;
  taskCount: number;
  duration: number;
  narrative?: NarrativeSettings;
  tasks?: Task[];
}

export interface GameSession {
  id: string;
  gameId: string;
  userId: string;
  status: string;
  totalPoints: number;
  currentTaskId: string | null;
  startedAt?: string;
  endsAt?: string;
}

export interface GameProgress {
  session: GameSession;
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
}

// Submission payloads per task type
export type TaskSubmission =
  | { scannedCode: string }
  | { latitude: number; longitude: number }
  | { answer: string }
  | { imageUrl: string }
  | { transcription: string };

export interface TaskAttempt {
  status: AttemptStatus;
  pointsAwarded: number;
  aiResult?: unknown;
}

export interface UnlockTaskPayload {
  [key: string]: unknown;
}

export interface UnlockTaskResult {
  unlocked: boolean;
  message: string;
}

export interface HintResult {
  hint: {
    content: string;
    pointPenalty: number;
  };
}

export interface PresignResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

export interface RankEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  points: number;
  completedTasks: number;
}

// Keep RankingEntry as alias for backward compat with ranking screen
export type RankingEntry = RankEntry;
