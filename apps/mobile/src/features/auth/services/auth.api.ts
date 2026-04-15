import { apiClient } from '@/shared/services/apiClient';
import type { User } from '@/shared/types/api.types';

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
