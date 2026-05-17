import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { haversineDistance } from '../../common/utils/geo';
import {
  AttemptStatus,
  Prisma,
  SessionStatus,
  TaskAttempt,
  TaskType,
  UnlockMethod,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withSerializableRetry } from '../../common/utils/prisma-retry';
import { RankingGateway } from '../ranking/ranking.gateway';
import { VerificationService } from '../task/verification/verification.service';
import { normalisePracticalSubmission } from '../task/verification/strategies/practical.strategy';
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

    const result = await this.verificationService.verify(task, submission);

    const statusMap: Record<string, AttemptStatus> = {
      CORRECT: AttemptStatus.CORRECT,
      INCORRECT: AttemptStatus.INCORRECT,
      PARTIAL: AttemptStatus.PARTIAL,
      ERROR: AttemptStatus.ERROR,
      PENDING: AttemptStatus.PENDING,
    };
    const attemptStatus = statusMap[result.status] ?? AttemptStatus.ERROR;
    const pointsAwarded =
      attemptStatus === AttemptStatus.PENDING
        ? 0
        : Math.round(result.score * task.maxPoints);

    const attempt = await withSerializableRetry(this.prisma, async (tx) => {
      // Guard against re-submission for an already-resolved task. The session
      // advances on CORRECT or PARTIAL (one shot at PARTIAL — see below), so
      // either of those terminates the task. PENDING re-submits after a
      // mentor approved with CORRECT would also let the mentor award points
      // twice.
      if (
        attemptStatus === AttemptStatus.CORRECT ||
        attemptStatus === AttemptStatus.PARTIAL ||
        attemptStatus === AttemptStatus.PENDING
      ) {
        const existingResolved = await tx.taskAttempt.findFirst({
          where: {
            sessionId: session.id,
            taskId,
            status: { in: [AttemptStatus.CORRECT, AttemptStatus.PARTIAL] },
          },
        });
        if (existingResolved) {
          throw new ConflictException('Task already completed');
        }
      }

      // Idempotent PENDING: if the player already has an open PENDING for
      // this task in the same session, return it instead of creating a
      // duplicate. Inside the tx so two concurrent submits can't both pass.
      if (attemptStatus === AttemptStatus.PENDING) {
        const existingPending = await tx.taskAttempt.findFirst({
          where: { sessionId: session.id, taskId, status: AttemptStatus.PENDING },
        });
        if (existingPending) return existingPending;
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

      // For PRACTICAL we replace whatever the client sent with a canonical
      // `{ requestedAt }` payload — the act of submitting is the request,
      // there's no answer content, so the DB shouldn't carry arbitrary keys.
      const persistedSubmission =
        task.type === TaskType.PRACTICAL
          ? normalisePracticalSubmission()
          : submission;

      const newAttempt = await tx.taskAttempt.create({
        data: {
          sessionId: session.id,
          taskId,
          userId,
          status: attemptStatus,
          attemptNumber: attemptCount + 1,
          submission: persistedSubmission as Prisma.InputJsonValue,
          aiResult: result.aiResult != null ? (result.aiResult as Prisma.InputJsonValue) : Prisma.JsonNull,
          pointsAwarded,
          clientSubmissionId: clientSubmissionId ?? null,
          clientCapturedAt: validCapturedAt,
        },
      });

      if (attemptStatus === AttemptStatus.CORRECT || attemptStatus === AttemptStatus.PARTIAL) {
        // PARTIAL advances the session same as CORRECT — one shot at partial
        // credit, no infinite gradient-climbing against a non-deterministic
        // AI evaluator. The dedupe check above blocks any re-submit.
        const updatedSession = await tx.gameSession.update({
          where: { id: session.id },
          data: { totalPoints: { increment: pointsAwarded } },
          select: { id: true, totalPoints: true, teamId: true },
        });

        const nextTask = await tx.task.findFirst({
          where: { gameId, orderIndex: { gt: task.orderIndex } },
          orderBy: { orderIndex: 'asc' },
        });

        if (updatedSession.teamId) {
          await tx.gameSession.updateMany({
            where: { gameId, teamId: updatedSession.teamId, status: SessionStatus.ACTIVE },
            data: {
              currentTaskId: nextTask?.id ?? null,
              status: nextTask ? SessionStatus.ACTIVE : SessionStatus.COMPLETED,
              completedAt: nextTask ? undefined : new Date(),
              totalPoints: updatedSession.totalPoints,
            },
          });
        } else {
          await tx.gameSession.update({
            where: { id: session.id },
            data: {
              currentTaskId: nextTask?.id ?? null,
              status: nextTask ? SessionStatus.ACTIVE : SessionStatus.COMPLETED,
              completedAt: nextTask ? undefined : new Date(),
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
}
