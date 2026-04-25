import { apiClient } from '@/shared/services/apiClient';
import type { BackendGame } from '@/shared/types/api.types';
import type { GameSession } from '@/shared/types/api.types';
import type { GameProgress } from '@/shared/types/api.types';
import type { TaskAttempt, UnlockTaskPayload, RankEntry } from '@/shared/types/api.types';
import type { Game } from '@/shared/types/api.types';
import { mapGame } from './mappers';
import type {
  UnlockTaskResult,
  HintResult,
  TaskSubmission,
} from '@citygame/shared';

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
  submitTask: (
    gameId: string,
    taskId: string,
    submission: TaskSubmission,
    clientSubmissionId?: string,
  ) =>
    apiClient.post<TaskAttempt>(`/games/${gameId}/tasks/${taskId}/submit`, {
      submission,
      clientSubmissionId,
    }),
  devComplete: (gameId: string, taskId: string) =>
    apiClient.post<TaskAttempt>(`/games/${gameId}/tasks/${taskId}/dev-complete`),
  useHint: (gameId: string, taskId: string) =>
    apiClient.post<HintResult>(`/games/${gameId}/tasks/${taskId}/hint`),
  ranking: (gameId: string) =>
    apiClient.get<RankEntry[]>(`/games/${gameId}/ranking`),
};
