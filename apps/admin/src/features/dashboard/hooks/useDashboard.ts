'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { GameStatus } from '@citygame/shared';

export interface GameListItem {
  id: string;
  title: string;
  city: string;
  status: GameStatus;
  taskCount: number;
}

export function useRecentGames(limit = 5) {
  return useQuery<GameListItem[]>({
    queryKey: ['admin-games', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<{ items: GameListItem[] }>(`/api/admin/games?limit=${limit}`);
      return Array.isArray(res) ? res : res?.items ?? [];
    },
  });
}
