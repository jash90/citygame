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

export const AI_PURPOSES = [
  'blueprint',
  'photoAi',
  'textAi',
  'audioAi',
  'editorHelpers',
] as const;
export type AiPurpose = (typeof AI_PURPOSES)[number];

export const AI_PROVIDERS = ['openrouter', 'openai'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiConfigResponse {
  provider: AiProvider;
  /** Whether an OpenAI API key is set (required when provider=openai). */
  openaiApiKeyConfigured: boolean;
  openaiApiKeyMasked: string | null;
  activeModel: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  useWebSearch: boolean;
  modelsByPurpose: Partial<Record<AiPurpose, string>>;
}

export function useAiModels() {
  return useQuery<ModelsResponse>({
    queryKey: ['ai-models'],
    queryFn: () => api.get('/api/admin/ai/models'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAiConfig() {
  return useQuery<AiConfigResponse>({
    queryKey: ['ai-config'],
    queryFn: () => api.get('/api/admin/ai/config'),
  });
}

export function useSetAiModel() {
  const queryClient = useQueryClient();
  return useMutation<{ activeModel: string }, Error, string>({
    mutationFn: (model: string) =>
      api.patch('/api/admin/ai/config', { model }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-models'] });
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
    },
  });
}

export function useSetAiProvider() {
  const queryClient = useQueryClient();
  return useMutation<{ provider: AiProvider }, Error, AiProvider>({
    mutationFn: (provider: AiProvider) =>
      api.patch('/api/admin/ai/config', { provider }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });
}

export function useSetAiUseWebSearch() {
  const queryClient = useQueryClient();
  return useMutation<{ useWebSearch: boolean }, Error, boolean>({
    mutationFn: (useWebSearch: boolean) =>
      api.patch('/api/admin/ai/config', { useWebSearch }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
    },
  });
}

export function useSetAiModelByPurpose() {
  const queryClient = useQueryClient();
  return useMutation<
    { modelsByPurpose: Partial<Record<AiPurpose, string>> },
    Error,
    { purpose: AiPurpose; model: string }
  >({
    mutationFn: ({ purpose, model }) =>
      api.patch('/api/admin/ai/config', {
        modelsByPurpose: { [purpose]: model },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
    },
  });
}

export function useSetAiApiKey() {
  const queryClient = useQueryClient();
  return useMutation<
    { apiKeyConfigured: boolean; apiKeyMasked: string | null },
    Error,
    string
  >({
    mutationFn: (apiKey: string) =>
      api.patch('/api/admin/ai/credentials', { apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });
}

export function useSetOpenaiApiKey() {
  const queryClient = useQueryClient();
  return useMutation<
    { openaiApiKeyConfigured: boolean; openaiApiKeyMasked: string | null },
    Error,
    string
  >({
    mutationFn: (apiKey: string) =>
      api.patch('/api/admin/ai/credentials/openai', { apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });
}

export function useClearOpenaiApiKey() {
  const queryClient = useQueryClient();
  return useMutation<
    { openaiApiKeyConfigured: boolean; openaiApiKeyMasked: string | null },
    Error,
    void
  >({
    mutationFn: () => api.delete('/api/admin/ai/credentials/openai'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });
}

export function useClearAiApiKey() {
  const queryClient = useQueryClient();
  return useMutation<
    { apiKeyConfigured: boolean; apiKeyMasked: string | null },
    Error,
    void
  >({
    mutationFn: () => api.delete('/api/admin/ai/credentials'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
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
