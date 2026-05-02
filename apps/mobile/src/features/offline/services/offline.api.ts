import { apiClient } from '@/shared/services/apiClient';
import type { OfflineBundle } from '@/features/offline/types';

export interface OfflineBundleVersionResponse {
  bundleVersion: number;
}

export const offlineApi = {
  bundle: (gameId: string): Promise<OfflineBundle> =>
    apiClient.get<OfflineBundle>(`/games/${gameId}/offline-bundle`),

  bundleVersion: (gameId: string): Promise<OfflineBundleVersionResponse> =>
    apiClient.get<OfflineBundleVersionResponse>(
      `/games/${gameId}/offline-bundle/version`,
    ),
};
