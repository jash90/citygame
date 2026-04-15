import { apiClient } from '@/shared/services/apiClient';
import type { UserProfile } from '@citygame/shared';

export const profileApi = {
  get: () => apiClient.get<UserProfile>('/profile'),
  update: (data: Partial<UserProfile>) =>
    apiClient.patch<UserProfile>('/profile', data),
};
