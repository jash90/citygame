// Fallback dev URLs in case EXPO_PUBLIC_LOCAL_* are not set in .env.
// Backend dev port is 3003 — see apps/backend/.env.
const DEV_API_URL_FALLBACK = 'http://127.0.0.1:3003/api';
const DEV_WS_URL_FALLBACK = 'http://127.0.0.1:3003';

/**
 * In a development build (__DEV__ === true) we point at the local backend
 * (EXPO_PUBLIC_LOCAL_* with a 127.0.0.1 fallback). In a release build we
 * point at the deployed backend (EXPO_PUBLIC_*). Both env vars must use the
 * EXPO_PUBLIC_ prefix or Expo strips them from the bundle.
 */
export const API_URL: string = __DEV__
  ? process.env.EXPO_PUBLIC_LOCAL_API_URL || DEV_API_URL_FALLBACK
  : process.env.EXPO_PUBLIC_API_URL || '';

export const WS_URL: string = __DEV__
  ? process.env.EXPO_PUBLIC_LOCAL_WS_URL || DEV_WS_URL_FALLBACK
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
