import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type {
  RevealedItem,
  UnlockedItems,
  UnlockRequirement,
} from '@citygame/shared';
import { haversineDistance } from '../../common/utils/geo';
import { normalizeAnswer } from '../../common/utils/offline-hash';
import {
  AttemptStatus,
  GameEnding,
  GameFlowType,
  Prisma,
  SessionStatus,
  TaskAttempt,
  TaskType,
  UnlockMethod,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withSerializableRetry } from '../../common/utils/prisma-retry';
import { GameEndingEvaluatorService } from '../game/game-ending-evaluator.service';
import { RankingGateway } from '../ranking/ranking.gateway';
import { VerificationService } from '../task/verification/verification.service';
import { ActivityBroadcastService } from './activity-broadcast.service';
import { PlayerHintService } from './player-hint.service';

const AI_TASK_TYPES = new Set<TaskType>([
  TaskType.PHOTO_AI,
  TaskType.TEXT_AI,
  TaskType.AUDIO_AI,
]);

@Injectable()
export class PlayerTaskService {
  private readonly logger = new Logger(PlayerTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
    private readonly rankingGateway: RankingGateway,
    private readonly activityBroadcast: ActivityBroadcastService,
    private readonly hintService: PlayerHintService,
    private readonly endingEvaluator: GameEndingEvaluatorService,
  ) {}

  /**
   * Unlock a task using the configured unlock method (QR or GPS).
   */
  async unlockTask(
    gameId: string,
    taskId: string,
    userId: string,
    unlockData: Record<string, unknown>,
  ): Promise<{ unlocked: boolean; message: string }> {
    await this.requireActiveSession(gameId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, gameId },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found in game ${gameId}`);
    }

    const unlockConfig = task.unlockConfig as Record<string, unknown>;

    if (task.unlockMethod === UnlockMethod.GPS) {
      const radiusMeters = (unlockConfig['radiusMeters'] as number) ?? 50;
      const targetLat = unlockConfig['targetLat'] as number | undefined ?? task.latitude;
      const targetLng = unlockConfig['targetLng'] as number | undefined ?? task.longitude;
      const playerLat = unlockData['latitude'] as number | undefined;
      const playerLng = unlockData['longitude'] as number | undefined;

      if (playerLat == null || playerLng == null) {
        return { unlocked: false, message: 'GPS coordinates required to unlock this task' };
      }

      const distance = haversineDistance(playerLat, playerLng, targetLat, targetLng);
      if (distance > radiusMeters) {
        return {
          unlocked: false,
          message: `You need to be within ${radiusMeters}m of the task location (currently ${Math.round(distance)}m away)`,
        };
      }

      return { unlocked: true, message: 'Location verified — task unlocked!' };
    }

    if (task.unlockMethod === UnlockMethod.QR) {
      const expectedCode = unlockConfig['qrCode'] as string | undefined;
      const scannedCode = unlockData['code'] as string | undefined;

      if (!scannedCode || scannedCode !== expectedCode) {
        return { unlocked: false, message: 'Invalid QR code' };
      }

      return { unlocked: true, message: 'QR code accepted — task unlocked!' };
    }

    if (task.unlockMethod === UnlockMethod.NONE) {
      return { unlocked: true, message: 'Task is open — no unlock required' };
    }

    return { unlocked: false, message: 'Unknown unlock method' };
  }

  /**
   * Submit an answer for a task. Creates a TaskAttempt, verifies it via the
   * unified strategy registry, awards points, advances to the next task,
   * updates the ranking, and fires WebSocket + push notifications.
   */
  async submitAnswer(
    gameId: string,
    taskId: string,
    userId: string,
    submission: Record<string, unknown>,
    clientSubmissionId?: string,
    clientCapturedAt?: string,
  ): Promise<TaskAttempt> {
    // Idempotency: if the client retried with the same submission id,
    // return the original attempt unchanged so offline → sync replays
    // never create duplicates.
    if (clientSubmissionId) {
      const existing = await this.prisma.taskAttempt.findUnique({
        where: { clientSubmissionId },
      });
      if (existing) return existing;
    }

    const session = await this.requireActiveSession(gameId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, gameId },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found in game ${gameId}`);
    }

    // Cipher chain gate: if the task has unlockRequirements, the player must
    // have collected the source item AND the submitted answer must match.
    const requirement = parseUnlockRequirement(task.unlockRequirements);
    if (requirement) {
      const sessionRow = await this.prisma.gameSession.findUnique({
        where: { id: session.id },
        select: { unlockedItems: true },
      });
      const inventory = (sessionRow?.unlockedItems ?? {}) as unknown as UnlockedItems;
      if (!inventory[requirement.requiresItem]) {
        throw new BadRequestException(
          `This task requires item "${requirement.requiresItem}" — collect it first.`,
        );
      }
      const answer = submission['answer'] as string | undefined;
      if (!answer) {
        throw new BadRequestException('Answer is required for this task.');
      }
      const submittedSha = createHash('sha256')
        .update(normalizeAnswer(answer))
        .digest('hex');
      if (submittedSha !== requirement.answerSha256) {
        // Same shape as a regular incorrect answer — let the verification path
        // record the attempt below.
      }
    }

    const result = await this.verificationService.verify(task, submission);

    const statusMap: Record<string, AttemptStatus> = {
      CORRECT: AttemptStatus.CORRECT,
      INCORRECT: AttemptStatus.INCORRECT,
      PARTIAL: AttemptStatus.PARTIAL,
      ERROR: AttemptStatus.ERROR,
    };
    const attemptStatus = statusMap[result.status] ?? AttemptStatus.ERROR;
    const pointsAwarded = Math.round(result.score * task.maxPoints);

    const attempt = await withSerializableRetry(this.prisma, async (tx) => {
      if (attemptStatus === AttemptStatus.CORRECT) {
        const existingCorrect = await tx.taskAttempt.findFirst({
          where: { sessionId: session.id, taskId, status: AttemptStatus.CORRECT },
        });
        if (existingCorrect) {
          throw new ConflictException('Task already completed');
        }
      }

      const attemptCount = await tx.taskAttempt.count({
        where: { sessionId: session.id, taskId },
      });

      // Trust the client timestamp for `clientCapturedAt` only if it parses
      // as a valid Date — class-validator already enforces ISO-8601 in the
      // DTO, but the sync service forwards arbitrary strings, so guard.
      const parsedCapturedAt = clientCapturedAt ? new Date(clientCapturedAt) : null;
      const validCapturedAt =
        parsedCapturedAt && !Number.isNaN(parsedCapturedAt.getTime())
          ? parsedCapturedAt
          : null;

      const newAttempt = await tx.taskAttempt.create({
        data: {
          sessionId: session.id,
          taskId,
          userId,
          status: attemptStatus,
          attemptNumber: attemptCount + 1,
          submission: submission as Prisma.InputJsonValue,
          aiResult: result.aiResult != null ? (result.aiResult as Prisma.InputJsonValue) : Prisma.JsonNull,
          pointsAwarded,
          clientSubmissionId: clientSubmissionId ?? null,
          clientCapturedAt: validCapturedAt,
        },
      });

      if (attemptStatus === AttemptStatus.CORRECT || attemptStatus === AttemptStatus.PARTIAL) {
        const updatedSession = await tx.gameSession.update({
          where: { id: session.id },
          data: { totalPoints: { increment: pointsAwarded } },
          select: { id: true, totalPoints: true, teamId: true },
        });

        if (attemptStatus === AttemptStatus.CORRECT) {
          // Merge any item this task reveals BEFORE evaluating endings, so an
          // ITEM_COLLECTED-conditioned ending can fire on the same submission.
          const revealed = parseRevealedItem(task.revealsItem);
          if (revealed) {
            await this.endingEvaluator.mergeRevealedItem(tx, session.id, revealed);
          }

          const game = await tx.game.findUnique({
            where: { id: gameId },
            select: { flowType: true },
          });
          const flowType = game?.flowType ?? GameFlowType.LINEAR;
          const nextTaskId = await this.computeNextTaskId(
            tx,
            flowType,
            gameId,
            taskId,
            task.orderIndex,
          );

          // Evaluate endings: if any matches, the session is COMPLETED via the
          // evaluator (which also stamps endingId + completedAt).
          const evalResult = await this.endingEvaluator.evaluateAndApply(
            tx,
            session.id,
          );

          // If no ending fired, advance currentTaskId per flow rules.
          if (!evalResult.ending) {
            if (updatedSession.teamId) {
              await tx.gameSession.updateMany({
                where: { gameId, teamId: updatedSession.teamId, status: SessionStatus.ACTIVE },
                data: {
                  currentTaskId: nextTaskId,
                  totalPoints: updatedSession.totalPoints,
                },
              });
            } else {
              await tx.gameSession.update({
                where: { id: session.id },
                data: { currentTaskId: nextTaskId },
              });
            }
          } else if (updatedSession.teamId) {
            // Cascade ending to all team members so they share the same end state.
            await tx.gameSession.updateMany({
              where: {
                gameId,
                teamId: updatedSession.teamId,
                status: SessionStatus.ACTIVE,
              },
              data: {
                endingId: evalResult.ending.id,
                status: SessionStatus.COMPLETED,
                completedAt: new Date(),
                totalPoints: updatedSession.totalPoints,
              },
            });
          }

          void this.activityBroadcast.handlePostCorrect(
            gameId,
            session.gameRunId,
            userId,
            taskId,
            task.title,
            pointsAwarded,
            updatedSession.totalPoints,
            updatedSession.teamId ?? null,
            newAttempt.id,
          ).catch((err) => this.logger.error('handlePostCorrect failed', err));
        }
      }

      return newAttempt;
    });

    if (AI_TASK_TYPES.has(task.type)) {
      this.rankingGateway.broadcastAiResult(gameId, {
        attemptId: attempt.id,
        userId,
        status: result.status,
        score: result.score,
        feedback: result.feedback,
      });
    }

    return attempt;
  }

  /**
   * Use a hint for a task. Records the usage and applies the point penalty
   * to the session's total score.
   */
  async useHint(
    gameId: string,
    taskId: string,
    userId: string,
  ): Promise<{ hint: { content: string; pointPenalty: number } }> {
    return this.hintService.useHint(gameId, taskId, userId);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async requireActiveSession(gameId: string, userId: string) {
    return this.hintService.requireActiveSession(gameId, userId);
  }

  /**
   * Decide the player's next currentTaskId based on game flow type.
   * - LINEAR: next task by orderIndex.
   * - OPEN_WORLD: clear (every task is freely accessible).
   * - BRANCHING / MIXED: any task with an incoming TaskTransition from the
   *   completed task that is not yet done. Tie-broken by orderIndex.
   */
  private async computeNextTaskId(
    tx: Prisma.TransactionClient,
    flowType: GameFlowType,
    gameId: string,
    completedTaskId: string,
    completedOrderIndex: number,
  ): Promise<string | null> {
    if (flowType === GameFlowType.LINEAR) {
      const next = await tx.task.findFirst({
        where: { gameId, orderIndex: { gt: completedOrderIndex } },
        orderBy: { orderIndex: 'asc' },
        select: { id: true },
      });
      return next?.id ?? null;
    }
    if (flowType === GameFlowType.OPEN_WORLD) {
      return null;
    }
    const transitions = await tx.taskTransition.findMany({
      where: { gameId, fromTaskId: completedTaskId },
      orderBy: { orderIndex: 'asc' },
      include: {
        toTask: { select: { id: true, orderIndex: true } },
      },
    });
    return transitions[0]?.toTask?.id ?? null;
  }
}

function parseRevealedItem(raw: unknown): RevealedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const slug = obj.slug;
  const kind = obj.kind;
  const label = obj.label;
  const value = obj.value;
  if (
    typeof slug !== 'string' ||
    typeof label !== 'string' ||
    typeof value !== 'string'
  ) {
    return null;
  }
  if (kind !== 'CODE' && kind !== 'WORD' && kind !== 'SYMBOL' && kind !== 'NUMBER') {
    return null;
  }
  return { slug, kind, label, value };
}

function parseUnlockRequirement(raw: unknown): UnlockRequirement | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.requiresItem !== 'string' ||
    typeof obj.answerSha256 !== 'string'
  ) {
    return null;
  }
  return {
    requiresItem: obj.requiresItem,
    answerSha256: obj.answerSha256,
  };
}

// Surface the unused-import suppressions so TS doesn't complain about the
// types we keep available for the helpers above.
export type { GameEnding };
