'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import type { UserRole, UserListItem, SystemInfo } from '@citygame/shared';

// ─── AI Models ────────────────────────────────────────────────────────────────

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
  };
  top_provider: { context_length: number; max_completion_tokens: number };
}

export interface ModelsResponse {
  models: OpenRouterModel[];
  activeModel: string;
}

export function useAiModels() {
  return useQuery<ModelsResponse>({
    queryKey: ['ai-models'],
    queryFn: () => api.get('/api/admin/ai/models'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetAiModel() {
  const queryClient = useQueryClient();
  return useMutation<{ activeModel: string }, Error, string>({
    mutationFn: (model: string) =>
      api.patch('/api/admin/ai/config', { model }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });
}

// ─── System Info ──────────────────────────────────────────────────────────────

export function useSystemInfo() {
  return useQuery<SystemInfo>({
    queryKey: ['system-info'],
    queryFn: () => api.get('/api/admin/system/info'),
    refetchInterval: 30_000,
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UsersResponse {
  items: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useUsers(params: {
  page: number;
  limit?: number;
  search?: string;
  role?: string;
}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('limit', String(params.limit ?? 20));
  if (params.search) {
    const sanitized = params.search.replace(/[%_]/g, '');
    if (sanitized) qs.set('search', sanitized);
  }
  if (params.role) qs.set('role', params.role);

  return useQuery<UsersResponse>({
    queryKey: ['admin-users', params.page, params.search, params.role],
    queryFn: () => api.get(`/api/admin/users?${qs.toString()}`),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.patch(`/api/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}
