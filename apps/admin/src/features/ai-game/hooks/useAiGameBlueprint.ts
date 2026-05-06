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

// AI blueprint generation chains 3 sequential model calls (outline → tasks
// → endings); the whole flow legitimately takes ~60–180s on slower models.
const AI_TIMEOUT_MS = 240_000;

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
