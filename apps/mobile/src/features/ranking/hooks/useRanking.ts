import { useQuery } from '@tanstack/react-query';
import { gamesApi } from '@/features/game/services/games.api';
import { QUERY_KEYS } from '@/shared/lib/constants';

export const useRanking = (gameId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.RANKING(gameId),
    queryFn: () => gamesApi.ranking(gameId),
    enabled: Boolean(gameId),
  });
};
