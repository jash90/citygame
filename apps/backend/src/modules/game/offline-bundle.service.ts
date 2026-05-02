import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GameStatus,
  RunStatus,
  TaskType,
  UnlockMethod,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Player-facing fields needed to play a game entirely offline.
 *
 * Sensitive bcrypt `answerHash` values are stripped — the bundle contains only
 * `offlineHash` + `offlineSalt` for fast on-device sha256 verification. AI tasks
 * (`PHOTO_AI`, `TEXT_AI`, `AUDIO_AI`) carry no useful verification config and
 * must be queued for server-side verification on reconnect.
 */
export interface OfflineBundleHint {
  id: string;
  orderIndex: number;
  content: string;
  pointPenalty: number;
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
  /** Filtered config — never includes bcrypt `answerHash`. */
  verifyConfig: Record<string, unknown>;
  maxPoints: number;
  timeLimitSec: number | null;
  storyContext: string | null;
  hints: OfflineBundleHint[];
  /** True if this task type cannot be verified offline (AI-driven). */
  requiresOnlineVerification: boolean;
  /** True if a non-AI task is missing the offlineHash backfill and cannot be played offline. */
  unsupportedOffline: boolean;
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
    settings: unknown;
    taskCount: number;
  };
  activeRun: {
    id: string;
    runNumber: number;
    status: RunStatus;
    startedAt: string;
    endsAt: string | null;
  } | null;
  tasks: OfflineBundleTask[];
  /** URLs the client should pre-download to FileSystem for offline rendering. */
  mediaManifest: string[];
}

const AI_TYPES = new Set<TaskType>([
  TaskType.PHOTO_AI,
  TaskType.TEXT_AI,
  TaskType.AUDIO_AI,
]);

export interface OfflineBundleVersion {
  bundleVersion: number;
}

@Injectable()
export class OfflineBundleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lightweight freshness check — returns just the `bundleVersion` so a client
   * with a cached bundle can decide whether to re-download without paying for
   * the full task/hint/media payload.
   */
  async buildBundleVersion(gameId: string): Promise<OfflineBundleVersion> {
    const game = await this.prisma.game.findFirst({
      where: { id: gameId, status: GameStatus.PUBLISHED },
      select: { updatedAt: true },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found or not published`);
    }

    return { bundleVersion: game.updatedAt.getTime() };
  }

  async buildBundle(gameId: string): Promise<OfflineBundle> {
    const game = await this.prisma.game.findFirst({
      where: { id: gameId, status: GameStatus.PUBLISHED },
      include: {
        tasks: {
          orderBy: { orderIndex: 'asc' },
          include: { hints: { orderBy: { orderIndex: 'asc' } } },
        },
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found or not published`);
    }

    const tasks: OfflineBundleTask[] = game.tasks.map((t) => {
      const verifyConfig = sanitizeVerifyConfig(t.type, t.verifyConfig);
      const unlockConfig = sanitizeUnlockConfig(t.unlockMethod, t.unlockConfig);
      const requiresOnlineVerification = AI_TYPES.has(t.type);
      const unsupportedOffline = !requiresOnlineVerification && needsOfflineHash(t.type) && !verifyConfig.offlineHash;

      return {
        id: t.id,
        gameId: t.gameId,
        title: t.title,
        description: t.description,
        type: t.type,
        unlockMethod: t.unlockMethod,
        orderIndex: t.orderIndex,
        latitude: t.latitude,
        longitude: t.longitude,
        unlockConfig,
        verifyConfig,
        maxPoints: t.maxPoints,
        timeLimitSec: t.timeLimitSec,
        storyContext: t.storyContext,
        hints: t.hints.map((h) => ({
          id: h.id,
          orderIndex: h.orderIndex,
          content: h.content,
          pointPenalty: h.pointPenalty,
        })),
        requiresOnlineVerification,
        unsupportedOffline,
      };
    });

    const mediaManifest = collectMediaUrls(game.coverImageUrl, tasks, game.settings);

    const activeRun = game.runs[0] ?? null;

    return {
      bundleVersion: game.updatedAt.getTime(),
      generatedAt: new Date().toISOString(),
      game: {
        id: game.id,
        title: game.title,
        description: game.description,
        city: game.city,
        coverImageUrl: game.coverImageUrl,
        settings: game.settings,
        taskCount: game.tasks.length,
      },
      activeRun: activeRun
        ? {
            id: activeRun.id,
            runNumber: activeRun.runNumber,
            status: activeRun.status,
            startedAt: activeRun.startedAt.toISOString(),
            endsAt: activeRun.endsAt ? activeRun.endsAt.toISOString() : null,
          }
        : null,
      tasks,
      mediaManifest,
    };
  }
}

/**
 * Strip secrets from `verifyConfig` per task type. We never expose the bcrypt
 * `answerHash`; only the fast offline hash + its salt are sent to the client.
 */
function sanitizeVerifyConfig(
  type: TaskType,
  raw: unknown,
): Record<string, unknown> {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  switch (type) {
    case TaskType.QR_SCAN:
      return cfg.expectedHash ? { expectedHash: cfg.expectedHash } : {};
    case TaskType.GPS_REACH:
      return {
        targetLat: cfg.targetLat,
        targetLng: cfg.targetLng,
        radiusMeters: cfg.radiusMeters ?? 20,
      };
    case TaskType.TEXT_EXACT:
    case TaskType.CIPHER: {
      const out: Record<string, unknown> = {};
      if (cfg.offlineHash) out.offlineHash = cfg.offlineHash;
      if (cfg.offlineSalt) out.offlineSalt = cfg.offlineSalt;
      if (cfg.cipherHint) out.cipherHint = cfg.cipherHint;
      return out;
    }
    case TaskType.PHOTO_AI:
    case TaskType.TEXT_AI:
    case TaskType.AUDIO_AI:
      // AI prompt content isn't useful offline; we just queue the submission.
      return {};
    case TaskType.MIXED: {
      const steps = cfg.steps as Array<Record<string, unknown>> | undefined;
      if (!steps) return {};
      return {
        steps: steps.map((step) =>
          sanitizeVerifyConfig(step.type as TaskType, step),
        ),
      };
    }
    default:
      return {};
  }
}

function sanitizeUnlockConfig(
  method: UnlockMethod,
  raw: unknown,
): Record<string, unknown> {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  switch (method) {
    case UnlockMethod.GPS:
      return {
        targetLat: cfg.targetLat,
        targetLng: cfg.targetLng,
        radiusMeters: cfg.radiusMeters ?? 50,
      };
    case UnlockMethod.QR:
      // QR codes are physical artifacts at the location — including the
      // expected plaintext is acceptable and necessary for offline unlock.
      return cfg.qrCode ? { qrCode: cfg.qrCode } : {};
    case UnlockMethod.NONE:
    default:
      return {};
  }
}

function needsOfflineHash(type: TaskType): boolean {
  return type === TaskType.TEXT_EXACT || type === TaskType.CIPHER;
}

function collectMediaUrls(
  coverImageUrl: string | null,
  tasks: OfflineBundleTask[],
  settings: unknown,
): string[] {
  const urls = new Set<string>();
  if (coverImageUrl) urls.add(coverImageUrl);

  // Settings.narrative may carry image references in story content.
  const narrative = (settings as Record<string, unknown> | null)?.narrative as
    | Record<string, unknown>
    | undefined;
  if (narrative) {
    for (const value of Object.values(narrative)) {
      if (typeof value === 'string' && /^https?:\/\//.test(value)) {
        urls.add(value);
      }
    }
  }

  for (const t of tasks) {
    // Task-level image hints could live in storyContext (JSON string) or in
    // verifyConfig — scan generically for http(s) URLs.
    if (t.storyContext) extractUrls(t.storyContext, urls);
  }

  return Array.from(urls);
}

function extractUrls(text: string, sink: Set<string>): void {
  const matches = text.match(/https?:\/\/[^\s"')]+/g);
  if (!matches) return;
  for (const m of matches) sink.add(m);
}
