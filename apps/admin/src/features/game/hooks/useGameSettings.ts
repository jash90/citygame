'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export function useUpdateGameSettings(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      api.patch(`/api/admin/games/${gameId}`, { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', gameId] });
      queryClient.invalidateQueries({ queryKey: ['admin-game', gameId] });
    },
  });
}
