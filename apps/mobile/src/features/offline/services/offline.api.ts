import { apiClient } from '@/shared/services/apiClient';
import type { OfflineBundle } from '@/features/offline/types';

export const offlineApi = {
  bundle: (gameId: string): Promise<OfflineBundle> =>
    apiClient.get<OfflineBundle>(`/games/${gameId}/offline-bundle`),
};
