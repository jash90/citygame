const DEV_API_URL = 'http://127.0.0.1:3001/api';
const DEV_WS_URL = 'http://127.0.0.1:3001';

export const API_URL: string = __DEV__
  ? DEV_API_URL
  : process.env.EXPO_PUBLIC_API_URL || '';

export const WS_URL: string = __DEV__
  ? DEV_WS_URL
  : process.env.EXPO_PUBLIC_WS_URL || '';

export const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: 'citygame_access_token',
  REFRESH_TOKEN: 'citygame_refresh_token',
  USER: 'citygame_user',
  PROFILE: 'citygame_profile',
} as const;

export const RANKING_WS_NAMESPACE = '/ranking';

/**
 * Vector tile style URL for MapLibre. Must point at a self-hosted style.json
 * (a public OSM-derived basic style) whose tiles are reachable while online,
 * and which the OfflineManager can pre-download for a city. Set this via the
 * `EXPO_PUBLIC_MAP_STYLE_URL` env var per environment.
 *
 * In dev we fall back to the public MapLibre demo tiles, which are NOT
 * cacheable for production offline packs.
 */
const DEV_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
export const MAP_STYLE_URL: string =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL || DEV_MAP_STYLE_URL;

export const QUERY_KEYS = {
  GAMES: ['games'] as const,
  GAME: (id: string) => ['games', id] as const,
  TASKS: (gameId: string) => ['tasks', gameId] as const,
  TASK: (taskId: string) => ['tasks', 'detail', taskId] as const,
  RANKING: (gameId: string) => ['ranking', gameId] as const,
  PROFILE: ['profile'] as const,
} as const;
