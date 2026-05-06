import type {
  GameEnding,
  GameFlowType,
  TaskTransition,
  TaskType,
  UnlockMethod,
} from '@citygame/shared';

/**
 * Mirrors `OfflineBundle` from the backend `offline-bundle.service.ts`.
 * Keep these shapes in sync — the wire contract is what links the two.
 */

export interface OfflineBundleHint {
  id: string;
  orderIndex: number;
  content: string;
  pointPenalty: number;
}

export interface OfflineBundleRevealedItem {
  slug: string;
  kind: string;
  label: string;
  value: string;
}

export interface OfflineBundleTask {
  id: string;
  gameId: string;
  title: string;
  description: string;
  type: TaskType;
  unlockMethod: UnlockMethod;
  orderIndex: number;
  latitude: number;
  longitude: number;
  unlockConfig: Record<string, unknown>;
  verifyConfig: Record<string, unknown>;
  maxPoints: number;
  timeLimitSec: number | null;
  storyContext: string | null;
  hints: OfflineBundleHint[];
  /** Cipher chain source — plaintext payload the player reads at this stop. */
  revealsItem: OfflineBundleRevealedItem | null;
  /** Cipher chain consumer — only the slug is exposed; answer hash stays server-side. */
  unlockRequirements: { requiresItem: string } | null;
  requiresOnlineVerification: boolean;
  unsupportedOffline: boolean;
}

export interface OfflineBundleActiveRun {
  id: string;
  runNumber: number;
  status: 'ACTIVE' | 'ENDED';
  startedAt: string;
  endsAt: string | null;
}

export interface OfflineBundle {
  bundleVersion: number;
  generatedAt: string;
  game: {
    id: string;
    title: string;
    description: string;
    city: string;
    coverImageUrl: string | null;
    flowType: GameFlowType;
    settings: unknown;
    taskCount: number;
  };
  activeRun: OfflineBundleActiveRun | null;
  tasks: OfflineBundleTask[];
  transitions: TaskTransition[];
  endings: GameEnding[];
  mediaManifest: string[];
}

export type DownloadStatus =
  | { kind: 'idle' }
  | { kind: 'downloading'; bytesTotal: number | null; bytesDone: number; mediaTotal: number; mediaDone: number }
  | { kind: 'ready'; downloadedAt: string }
  | { kind: 'error'; message: string };

export interface StoredOfflineBundle {
  bundle: OfflineBundle;
  /** Map of remote URL → local FileSystem path for cached media. */
  mediaCache: Record<string, string>;
  status: DownloadStatus;
}
