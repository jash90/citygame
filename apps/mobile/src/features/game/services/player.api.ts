import { apiClient } from '@/shared/services/apiClient';
import type { ActiveSessionResponse, RunAnswersResponse } from '@citygame/shared';

export const playerApi = {
  activeSession: () =>
    apiClient.get<ActiveSessionResponse | null>('/player/active-session'),
  runAnswers: (gameId: string, runNumber: number) =>
    apiClient.get<RunAnswersResponse>(`/games/${gameId}/runs/${runNumber}/answers`),
};
