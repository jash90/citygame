import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Game, GameStatus, Prisma, TaskType } from '@prisma/client';
import { createHash } from 'crypto';
import {
  blueprintInputSchema,
  gameBlueprintSchema,
  GameFlowType,
  type BlueprintEnding,
  type BlueprintInput,
  type BlueprintTask,
  type BlueprintTransition,
  type GameBlueprint,
} from '@citygame/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAnswerHashes, normalizeAnswer } from '../../common/utils/offline-hash';

/**
 * Translates a validated `GameBlueprint` into rows in the database.
 * - Creates one DRAFT Game with the requested `flowType`.
 * - Creates Tasks with hashed verifyConfig (using existing `buildAnswerHashes`).
 * - Creates Hints, TaskTransitions, and GameEndings.
 * - Always materialises one ending with `isDefault=true` so legacy reads find a row.
 *
 * The cipher / code-chain mechanic is realised here: the AI emits plaintext
 * `expectedAnswer` on the source task; this service hashes it into both the
 * verifyConfig AND the matching consumer task's `unlockRequirements.answerSha256`.
 */
@Injectable()
export class GameBlueprintPersistenceService {
  private readonly logger = new Logger(GameBlueprintPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createGameFromBlueprint(
    blueprint: GameBlueprint,
    input: BlueprintInput,
    creatorId: string,
  ): Promise<Game> {
    const safeInput = blueprintInputSchema.parse(input);
    const safeBlueprint = gameBlueprintSchema.parse(blueprint) as GameBlueprint;

    // Pre-compute task answer hashes so they're consistent across verifyConfig
    // and unlockRequirements (cipher chain consumers). MIXED tasks need their
    // sub-step hashes computed up-front too — bcrypt is async and we want to
    // keep the per-task transaction loop synchronous.
    const taskHashes = await this.computeTaskHashes(safeBlueprint.tasks);
    const mixedStepsByIndex = await this.computeMixedSteps(safeBlueprint.tasks);

    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          title: safeBlueprint.title,
          description: safeBlueprint.description,
          city: safeBlueprint.city,
          flowType: safeBlueprint.flowType,
          status: GameStatus.DRAFT,
          creatorId,
          settings: this.buildSettings(safeBlueprint, safeInput),
        },
      });

      const indexToTaskId = new Map<number, string>();

      for (const bpTask of safeBlueprint.tasks) {
        const hashes = taskHashes.get(bpTask.index);
        const verifyConfig = this.buildVerifyConfig(bpTask, hashes, mixedStepsByIndex);
        const unlockConfig = this.buildUnlockConfig(bpTask);
        const unlockRequirements = this.buildUnlockRequirements(
          bpTask,
          taskHashes,
        );

        const created = await tx.task.create({
          data: {
            gameId: game.id,
            title: bpTask.title,
            description: bpTask.description,
            type: bpTask.type,
            unlockMethod: bpTask.unlockMethod,
            orderIndex: bpTask.index - 1,
            latitude: bpTask.latitude,
            longitude: bpTask.longitude,
            unlockConfig: unlockConfig as Prisma.InputJsonValue,
            verifyConfig: verifyConfig as Prisma.InputJsonValue,
            maxPoints: bpTask.maxPoints,
            timeLimitSec: bpTask.timeLimitSec ?? null,
            storyContext: serializeStoryContext(bpTask.storyContext),
            revealsItem: bpTask.revealsItem
              ? (bpTask.revealsItem as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            unlockRequirements: unlockRequirements
              ? (unlockRequirements as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        });
        indexToTaskId.set(bpTask.index, created.id);

        if (bpTask.hints.length) {
          await tx.hint.createMany({
            data: bpTask.hints.map((h, i) => ({
              taskId: created.id,
              content: h.content,
              pointPenalty: h.pointPenalty,
              orderIndex: i,
            })),
          });
        }
      }

      await this.persistTransitions(
        tx,
        game.id,
        safeBlueprint.flowType,
        safeBlueprint.transitions,
        safeBlueprint.tasks,
        indexToTaskId,
      );

      await this.persistEndings(
        tx,
        game.id,
        safeBlueprint.endings,
        indexToTaskId,
      );

      this.logger.log(
        `AI blueprint persisted as game ${game.id} (${safeBlueprint.flowType}, ${safeBlueprint.tasks.length} tasks, ${safeBlueprint.endings.length} endings)`,
      );

      return game;
    }, { timeout: 30_000 });
  }

  // ── verifyConfig / unlockConfig builders ────────────────────────────────

  private buildVerifyConfig(
    bpTask: BlueprintTask,
    hashes: Awaited<ReturnType<typeof buildAnswerHashes>> | undefined,
    mixedStepsByIndex?: Map<number, Record<string, unknown>[]>,
  ): Record<string, unknown> {
    switch (bpTask.type) {
      case TaskType.QR_SCAN: {
        // Fall back to a deterministic placeholder when the model forgot to
        // emit `expectedAnswer`. The operator can regenerate or edit it later;
        // failing the whole save here would force a full re-roll.
        const plaintext =
          bpTask.expectedAnswer && bpTask.expectedAnswer.trim().length > 0
            ? bpTask.expectedAnswer.trim()
            : `task-${bpTask.index}-qr`;
        if (!bpTask.expectedAnswer) {
          this.logger.warn(
            `Task ${bpTask.index} (QR_SCAN) had no expectedAnswer — using placeholder "${plaintext}"`,
          );
        }
        const sha = createHash('sha256').update(plaintext).digest('hex');
        // Keep plaintext alongside the hash so admins can see / print the
        // sticker text. Stripped from the offline bundle by sanitizer's allow-
        // list, so players never see it.
        return {
          type: 'QR_SCAN',
          expectedHash: `sha256:${sha}`,
          expectedAnswer: plaintext,
        };
      }
      case TaskType.GPS_REACH:
        return {
          type: 'GPS_REACH',
          targetLat: bpTask.latitude,
          targetLng: bpTask.longitude,
          radiusMeters: bpTask.radiusMeters ?? 30,
        };
      case TaskType.TEXT_EXACT:
      case TaskType.CIPHER: {
        if (!hashes) {
          throw new BadRequestException(
            `Task ${bpTask.index} requires expectedAnswer`,
          );
        }
        const cfg: Record<string, unknown> = {
          type: bpTask.type === TaskType.CIPHER ? 'CIPHER' : 'TEXT_EXACT',
          answerHash: hashes.answerHash,
          offlineHash: hashes.offlineHash,
          offlineSalt: hashes.offlineSalt,
        };
        // Keep plaintext for admin viewing/editing. Mobile-side sanitizer
        // strips it via allow-list — see offline-bundle.service.
        if (bpTask.expectedAnswer) cfg.expectedAnswer = bpTask.expectedAnswer;
        if (bpTask.cipherHint) cfg.cipherHint = bpTask.cipherHint;
        if (bpTask.caseSensitive) cfg.caseSensitive = true;
        return cfg;
      }
      case TaskType.TEXT_AI:
      case TaskType.PHOTO_AI:
      case TaskType.AUDIO_AI: {
        if (!bpTask.aiPrompt) {
          throw new BadRequestException(
            `Task ${bpTask.index} (${bpTask.type}) requires aiPrompt`,
          );
        }
        return {
          type: bpTask.type,
          prompt: bpTask.aiPrompt,
          threshold: bpTask.aiThreshold ?? 0.7,
        };
      }
      case TaskType.MIXED: {
        // The hashed step array is pre-computed in `computeMixedSteps` and
        // looked up here so this method can stay synchronous (the caller
        // iterates tasks in a tight loop inside the transaction).
        const steps = mixedStepsByIndex?.get(bpTask.index) ?? [];
        return { type: 'MIXED', steps };
      }
      default:
        throw new BadRequestException(
          `Unsupported task type: ${String(bpTask.type)}`,
        );
    }
  }

  private buildUnlockConfig(bpTask: BlueprintTask): Record<string, unknown> {
    switch (bpTask.unlockMethod) {
      case 'GPS':
        return {
          method: 'GPS',
          targetLat: bpTask.latitude,
          targetLng: bpTask.longitude,
          radiusMeters: bpTask.radiusMeters ?? 50,
        };
      case 'QR':
        return { method: 'QR' };
      case 'NONE':
      default:
        return { method: 'NONE' };
    }
  }

  private buildUnlockRequirements(
    bpTask: BlueprintTask,
    taskHashes: Map<number, Awaited<ReturnType<typeof buildAnswerHashes>>>,
  ): { requiresItem: string; answerSha256: string } | null {
    if (!bpTask.unlockRequirements) return null;
    // Hash the consumer's expected plaintext answer (matches the source's
    // revealsItem.value by construction, validated by the blueprint schema).
    const sha = createHash('sha256')
      .update(normalizeAnswer(bpTask.unlockRequirements.expectedAnswer))
      .digest('hex');
    void taskHashes; // future use if we need to align with verifyConfig hashes
    return {
      requiresItem: bpTask.unlockRequirements.requiresItem,
      answerSha256: sha,
    };
  }

  // ── Transitions / endings ───────────────────────────────────────────────

  private async persistTransitions(
    tx: Prisma.TransactionClient,
    gameId: string,
    flowType: GameFlowType,
    blueprintTransitions: BlueprintTransition[],
    tasks: BlueprintTask[],
    indexToTaskId: Map<number, string>,
  ): Promise<void> {
    let rows = blueprintTransitions.map((t, idx) => ({
      gameId,
      fromTaskId: t.fromTaskIndex !== null
        ? (indexToTaskId.get(t.fromTaskIndex) ?? null)
        : null,
      toTaskId: indexToTaskId.get(t.toTaskIndex)!,
      label: t.label ?? null,
      orderIndex: idx,
    }));

    // OPEN_WORLD games: ensure every task is reachable from null start.
    if (flowType === GameFlowType.OPEN_WORLD) {
      const reachableFromStart = new Set(
        rows.filter((r) => r.fromTaskId === null).map((r) => r.toTaskId),
      );
      const missing = tasks
        .map((t) => indexToTaskId.get(t.index)!)
        .filter((id) => !reachableFromStart.has(id));
      rows = [
        ...rows,
        ...missing.map((toTaskId, i) => ({
          gameId,
          fromTaskId: null,
          toTaskId,
          label: null,
          orderIndex: rows.length + i,
        })),
      ];
    }

    if (rows.length) {
      await tx.taskTransition.createMany({ data: rows });
    }
  }

  private async persistEndings(
    tx: Prisma.TransactionClient,
    gameId: string,
    endings: BlueprintEnding[],
    indexToTaskId: Map<number, string>,
  ): Promise<void> {
    const rows = endings.map((e, idx) => ({
      gameId,
      slug: e.slug,
      title: e.title,
      description: e.description,
      condition: this.translateCondition(e, indexToTaskId) as Prisma.InputJsonValue,
      isDefault: e.isDefault,
      orderIndex: idx,
    }));
    await tx.gameEnding.createMany({ data: rows });
  }

  private translateCondition(
    ending: BlueprintEnding,
    indexToTaskId: Map<number, string>,
  ): Record<string, unknown> {
    const c = ending.condition;
    switch (c.type) {
      case 'ALL_OF':
      case 'ANY_OF': {
        const taskIds = c.taskIndices.map((i) => indexToTaskId.get(i)!);
        return { type: c.type, taskIds };
      }
      case 'SCORE_GTE':
        return { type: 'SCORE_GTE', minScore: c.minScore };
      case 'ITEM_COLLECTED':
        return { type: 'ITEM_COLLECTED', slug: c.slug };
      case 'TIMEOUT':
        return { type: 'TIMEOUT' };
      case 'DEFAULT':
        return { type: 'DEFAULT' };
    }
  }

  private buildSettings(
    blueprint: GameBlueprint,
    input: BlueprintInput,
  ): Prisma.InputJsonValue {
    return {
      timeLimitMinutes: input.durationMinutes,
      narrative: {
        isNarrative: true,
        theme: blueprint.theme,
        prologue: blueprint.prologue ?? null,
      },
    };
  }

  private async computeTaskHashes(
    tasks: BlueprintTask[],
  ): Promise<Map<number, Awaited<ReturnType<typeof buildAnswerHashes>>>> {
    const map = new Map<number, Awaited<ReturnType<typeof buildAnswerHashes>>>();
    for (const t of tasks) {
      if (
        (t.type === TaskType.TEXT_EXACT || t.type === TaskType.CIPHER) &&
        t.expectedAnswer
      ) {
        map.set(t.index, await buildAnswerHashes(t.expectedAnswer));
      }
    }
    return map;
  }

  /**
   * Pre-hashes every MIXED task's sub-steps. Each step gets the same
   * verifyConfig shape its standalone equivalent would have (sha256 for
   * QR_SCAN, bcrypt + offline-hash triple for TEXT_EXACT/CIPHER, prompt+
   * threshold for *_AI, GPS coords from parent for GPS_REACH). Plaintext
   * answers are kept alongside the hashes so admins can read them; the
   * offline bundle's allow-list strips them when shipping to mobile.
   */
  private async computeMixedSteps(
    tasks: BlueprintTask[],
  ): Promise<Map<number, Record<string, unknown>[]>> {
    const map = new Map<number, Record<string, unknown>[]>();
    for (const t of tasks) {
      if (t.type !== TaskType.MIXED) continue;
      const rawSteps = t.mixedSteps ?? [];
      if (rawSteps.length < 2) {
        this.logger.warn(
          `MIXED task ${t.index} has ${rawSteps.length} mixedSteps — minimum 2 required; persisting empty array (admin must edit).`,
        );
        map.set(t.index, []);
        continue;
      }
      const steps = await Promise.all(
        rawSteps.map((step) => this.buildMixedStepConfig(step, t)),
      );
      map.set(t.index, steps);
    }
    return map;
  }

  private async buildMixedStepConfig(
    step: NonNullable<BlueprintTask['mixedSteps']>[number],
    parent: BlueprintTask,
  ): Promise<Record<string, unknown>> {
    switch (step.type) {
      case TaskType.QR_SCAN: {
        const plaintext =
          step.expectedAnswer?.trim() || `task-${parent.index}-qr`;
        const sha = createHash('sha256').update(plaintext).digest('hex');
        return {
          type: 'QR_SCAN',
          expectedHash: `sha256:${sha}`,
          expectedAnswer: plaintext,
        };
      }
      case TaskType.GPS_REACH:
        return {
          type: 'GPS_REACH',
          targetLat: parent.latitude,
          targetLng: parent.longitude,
          radiusMeters: step.radiusMeters ?? parent.radiusMeters ?? 30,
        };
      case TaskType.TEXT_EXACT:
      case TaskType.CIPHER: {
        const plaintext = step.expectedAnswer?.trim();
        if (!plaintext) {
          throw new BadRequestException(
            `MIXED task ${parent.index} step (${step.type}) requires expectedAnswer`,
          );
        }
        const hashes = await buildAnswerHashes(plaintext);
        const cfg: Record<string, unknown> = {
          type: step.type,
          answerHash: hashes.answerHash,
          offlineHash: hashes.offlineHash,
          offlineSalt: hashes.offlineSalt,
          expectedAnswer: plaintext,
        };
        if (step.type === TaskType.CIPHER && step.cipherHint) {
          cfg.cipherHint = step.cipherHint;
        }
        return cfg;
      }
      case TaskType.PHOTO_AI:
      case TaskType.TEXT_AI:
      case TaskType.AUDIO_AI: {
        if (!step.aiPrompt) {
          throw new BadRequestException(
            `MIXED task ${parent.index} step (${step.type}) requires aiPrompt`,
          );
        }
        return {
          type: step.type,
          prompt: step.aiPrompt,
          threshold: step.aiThreshold ?? 0.7,
        };
      }
      default:
        throw new BadRequestException(
          `Unsupported MIXED sub-step type: ${String(step.type)}`,
        );
    }
  }
}

/**
 * Persist `storyContext` in the same JSON shape the editor's
 * `parseStoryContext` expects: an object with the 4 narrative slots. The AI
 * sometimes emits free prose; fall back by putting that prose into the
 * `taskNarrative` slot so the admin sees it.
 */
function serializeStoryContext(value: BlueprintTask['storyContext']): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return JSON.stringify({ taskNarrative: trimmed });
  }
  // Drop empty fields so we don't store '{}'.
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && v.trim().length > 0) cleaned[k] = v.trim();
  }
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}
