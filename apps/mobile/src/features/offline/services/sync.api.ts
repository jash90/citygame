import { apiClient } from '@/shared/services/apiClient';

export interface SyncRequestItem {
  clientSubmissionId: string;
  type: 'submit' | 'hint' | 'unlock';
  taskId: string;
  payload?: Record<string, unknown>;
  capturedAt?: string;
}

export interface SyncResultSuccess {
  clientSubmissionId: string;
  ok: true;
  type: SyncRequestItem['type'];
  result: Record<string, unknown>;
}

export interface SyncResultFailure {
  clientSubmissionId: string;
  ok: false;
  type: SyncRequestItem['type'];
  error: string;
  statusCode?: number;
}

export type SyncResult = SyncResultSuccess | SyncResultFailure;

export interface SyncResponse {
  results: SyncResult[];
}

export const syncApi = {
  flush: (gameId: string, items: SyncRequestItem[]): Promise<SyncResponse> =>
    apiClient.post<SyncResponse>(`/games/${gameId}/sync`, { items }),
};
