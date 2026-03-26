export enum TaskType {
  QR_SCAN = 'QR_SCAN',
  GPS_REACH = 'GPS_REACH',
  PHOTO_AI = 'PHOTO_AI',
  AUDIO_AI = 'AUDIO_AI',
  TEXT_EXACT = 'TEXT_EXACT',
  TEXT_AI = 'TEXT_AI',
  CIPHER = 'CIPHER',
  MIXED = 'MIXED',
}

export enum UnlockMethod {
  QR = 'QR',
  GPS = 'GPS',
}

// Discriminated union for verifyConfig per TaskType
export interface QrScanConfig {
  type: 'QR_SCAN';
  expectedHash: string;
}

export interface GpsReachConfig {
  type: 'GPS_REACH';
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface TextExactConfig {
  type: 'TEXT_EXACT';
  answerHash: string;
  caseSensitive?: boolean;
}

export interface PhotoAiConfig {
  type: 'PHOTO_AI';
  prompt: string;
  threshold: number;
  maxTokens?: number;
}

export interface TextAiConfig {
  type: 'TEXT_AI';
  prompt: string;
  threshold: number;
  maxTokens?: number;
}

export interface AudioAiConfig {
  type: 'AUDIO_AI';
  prompt: string;
  threshold: number;
}

export interface CipherConfig {
  type: 'CIPHER';
  answerHash: string;
  cipherHint?: string;
}

export interface MixedConfig {
  type: 'MIXED';
  steps: VerifyConfig[];
}

export type VerifyConfig =
  | QrScanConfig
  | GpsReachConfig
  | TextExactConfig
  | PhotoAiConfig
  | TextAiConfig
  | AudioAiConfig
  | CipherConfig
  | MixedConfig;

export interface UnlockQrConfig {
  method: 'QR';
  expectedHash: string;
}

export interface UnlockGpsConfig {
  method: 'GPS';
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export type TaskUnlockConfig = UnlockQrConfig | UnlockGpsConfig;

export interface Task {
  id: string;
  gameId: string;
  title: string;
  description: string;
  type: TaskType;
  unlockMethod: UnlockMethod;
  orderIndex: number;
  latitude: number;
  longitude: number;
  unlockConfig: TaskUnlockConfig;
  verifyConfig: VerifyConfig;
  maxPoints: number;
  timeLimitSec?: number;
  hints?: Hint[];
}

export interface Hint {
  id: string;
  taskId: string;
  orderIndex: number;
  content: string;
  pointPenalty: number;
}

export interface CreateTaskDto {
  title: string;
  description: string;
  type: TaskType;
  unlockMethod: UnlockMethod;
  orderIndex: number;
  latitude: number;
  longitude: number;
  unlockConfig: TaskUnlockConfig;
  verifyConfig: VerifyConfig;
  maxPoints: number;
  timeLimitSec?: number;
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {}
