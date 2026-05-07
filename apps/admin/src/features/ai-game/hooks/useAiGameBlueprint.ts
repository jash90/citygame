'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BlueprintInput,
  GameBlueprint,
  Game,
} from '@citygame/shared';
import { api } from '@/shared/lib/api';

interface BlueprintEnvelope {
  blueprint: GameBlueprint;
}

// AI blueprint generation chains 7–8 sequential model calls (research →
// geocode → outline → cipher plan → tasks → endings → validation) plus
// optional `:online` web-search; legitimate runs hit 8–15 minutes on slower
// models. Backend SDK timeout is 300 s per call, so the orchestrator may
// take longer end-to-end. Keep the client-side abort generous.
const AI_TIMEOUT_MS = 1_200_000; // 20 min

export function useGenerateBlueprint() {
  return useMutation<GameBlueprint, Error, BlueprintInput>({
    mutationFn: async (input) => {
      const res = await api.post<BlueprintEnvelope>(
        '/api/admin/ai/games/blueprint',
        input,
        { timeoutMs: AI_TIMEOUT_MS },
      );
      return res.blueprint;
    },
  });
}

export function useRefineBlueprint() {
  return useMutation<
    GameBlueprint,
    Error,
    {
      stage: 'tasks' | 'endings' | 'task';
      taskIndex?: number;
      blueprint: GameBlueprint;
      input: BlueprintInput;
    }
  >({
    mutationFn: async (payload) => {
      const res = await api.post<BlueprintEnvelope>(
        '/api/admin/ai/games/blueprint/refine',
        payload,
        { timeoutMs: AI_TIMEOUT_MS },
      );
      return res.blueprint;
    },
  });
}

export function useCreateGameFromBlueprint() {
  const queryClient = useQueryClient();
  return useMutation<
    Game,
    Error,
    { blueprint: GameBlueprint; input: BlueprintInput }
  >({
    mutationFn: (payload) =>
      api.post<Game>('/api/admin/games/from-blueprint', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['games'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-games'] });
    },
  });
}
