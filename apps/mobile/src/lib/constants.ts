import Constants from 'expo-constants';
import { brandName } from './brand';

const extra = Constants.expoConfig?.extra ?? {};

export const API_URL: string =
  (extra.apiUrl as string | undefined) ?? 'http://localhost:3001/api';

export const WS_URL: string =
  (extra.wsUrl as string | undefined) ?? 'http://localhost:3001';

export const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: `${brandName}_access_token`,
  REFRESH_TOKEN: `${brandName}_refresh_token`,
  USER: `${brandName}_user`,
} as const;

export const RANKING_WS_NAMESPACE = '/ranking';

export const QUERY_KEYS = {
  GAMES: ['games'] as const,
  GAME: (id: string) => ['games', id] as const,
  TASKS: (gameId: string) => ['tasks', gameId] as const,
  TASK: (taskId: string) => ['tasks', 'detail', taskId] as const,
  RANKING: (gameId: string) => ['ranking', gameId] as const,
  PROFILE: ['profile'] as const,
} as const;
