export { TaskType, UnlockMethod } from '../types/task';
export { GameStatus } from '../types/game';
export { UserRole } from '../types/user';
export { SessionStatus, AttemptStatus } from '../types/session';
export { WsEvent } from '../types/ws';

export const TASK_TYPE_LABELS: Record<string, string> = {
  QR_SCAN: 'Skan QR',
  GPS_REACH: 'Punkt GPS',
  PHOTO_AI: 'Zdjęcie (AI)',
  AUDIO_AI: 'Nagranie (AI)',
  TEXT_EXACT: 'Odpowiedź tekstowa',
  TEXT_AI: 'Tekst (AI)',
  CIPHER: 'Szyfr',
  MIXED: 'Mieszane',
};

export const UNLOCK_METHOD_LABELS: Record<string, string> = {
  QR: 'Kod QR',
  GPS: 'Lokalizacja GPS',
};

export const GAME_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Szkic',
  PUBLISHED: 'Opublikowana',
  ARCHIVED: 'Zarchiwizowana',
};

export const DEFAULT_GPS_RADIUS_METERS = 50;
export const DEFAULT_AI_THRESHOLD = 0.7;
export const MAX_HINTS_PER_TASK = 3;
export const WS_RANKING_NAMESPACE = '/ranking';
