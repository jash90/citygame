import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { haversineDistance } from '../../common/utils/geo';
import {
  AttemptStatus,
  GameSession,
  GameStatus,
  Prisma,
  RunStatus,
  SessionStatus,
  TaskAttempt,
  TaskType,
  UnlockMethod,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withSerializableRetry } from '../../common/utils/prisma-retry';
import { RankingGateway } from '../ranking/ranking.gateway';
import { TeamService } from '../team/team.service';
import { VerificationService } from '../task/verification/verification.service';
import type { GameSettings } from '../../common/types/game-settings';
import { ActivityBroadcastService } from './activity-broadcast.service';

const AI_TASK_TYPES = new Set<TaskType>([
  TaskType.PHOTO_AI,
  TaskType.TEXT_AI,
  TaskType.AUDIO_AI,
]);

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
    private readonly rankingGateway: RankingGateway,
    private readonly teamService: TeamService,
    private readonly activityBroadcast: ActivityBroadcastService,
  ) {}

  /**
   * Start a new game session for the authenticated user.
   * In team mode, the user must be in a team. All team members share one session —
   * if the team session already exists, it is returned directly.
   * Returns the created (or existing) session with the first task set as currentTaskId.
   */
  async startGame(gameId: string, userId: string): Promise<GameSession> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' }, take: 1 },
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    if (game.status !== GameStatus.PUBLISHED) {
      throw new ForbiddenException('This game is not available for play');
    }

    const activeRun = game.runs[0];
    if (!activeRun) {
      throw new ForbiddenException('This game has no active session');
    }

    // Check if the current run has expired
    if (activeRun.endsAt && new Date(activeRun.endsAt) < new Date()) {
      throw new ForbiddenException('This game run has ended');
    }

    const settings = game.settings as GameSettings;

    if (settings.teamMode) {
      return this.startTeamGame(gameId, userId, game.tasks[0]?.id ?? null, activeRun.id);
    }

    const existingSession = await this.prisma.gameSession.findUnique({
      where: {
        gameRunId_userId: { gameRunId: activeRun.id, userId },
      },
    });

    if (existingSession) {
      if (existingSession.status === SessionStatus.ACTIVE) {
        return existingSession;
      }
      throw new ConflictException('You have already played this game run');
    }

    const session = await this.prisma.gameSession.create({
      data: {
        gameId,
        userId,
        gameRunId: activeRun.id,
        status: SessionStatus.ACTIVE,
        currentTaskId: game.tasks[0]?.id ?? null,
      },
    });

    // Broadcast join activity to admin monitoring
    void this.activityBroadcast.broadcastJoinActivity(gameId, userId)
      .catch((err) => this.logger.error('broadcastJoinActivity failed', err));

    return session;
  }

  /**
   * Handle session start for a team-mode game.
   * The first team member to call startGame creates the shared session;
   * subsequent members receive the existing active session.
   *
   * Uses a serializable transaction to prevent race conditions when multiple
   * team members join simultaneously.
   */
  private async startTeamGame(
    gameId: string,
    userId: string,
    firstTaskId: string | null,
    gameRunId: string,
  ): Promise<GameSession> {
    const membership = await this.teamService.findMembership(gameId, userId);

    if (!membership) {
      throw new BadRequestException(
        'You must join a team before starting this game',
      );
    }

    const { teamId } = membership;

    const session = await withSerializableRetry(this.prisma, async (tx) => {
      // Check if any team member already has a session for this run — shared team session
      const existingTeamSession = await tx.gameSession.findFirst({
        where: { gameId, teamId, gameRunId },
      });

      if (existingTeamSession) {
        if (existingTeamSession.status === SessionStatus.ACTIVE) {
          const userSession = await tx.gameSession.findUnique({
            where: {
              gameRunId_userId: { gameRunId, userId },
            },
          });
          if (!userSession) {
            // Re-read latest points inside transaction to avoid desync
            const canonicalSession = await tx.gameSession.findFirst({
              where: { gameId, teamId, gameRunId, status: SessionStatus.ACTIVE },
              orderBy: { startedAt: 'asc' },
              select: { totalPoints: true, currentTaskId: true },
            });
            return tx.gameSession.create({
              data: {
                gameId,
                userId,
                teamId,
                gameRunId,
                status: SessionStatus.ACTIVE,
                totalPoints: canonicalSession?.totalPoints ?? 0,
                currentTaskId: canonicalSession?.currentTaskId ?? existingTeamSession.currentTaskId,
              },
            });
          }
          return userSession;
        }
        throw new ConflictException('Your team has already played this game run');
      }

      return tx.gameSession.create({
        data: {
          gameId,
          userId,
          teamId,
          gameRunId,
          status: SessionStatus.ACTIVE,
          currentTaskId: firstTaskId,
        },
      });
    });

    void this.activityBroadcast.broadcastJoinActivity(gameId, userId)
      .catch((err) => this.logger.error('broadcastJoinActivity failed', err));

    return session;
  }

  /**
   * Get the player's current progress: session, completed tasks, hint usages.
   */
  async getProgress(gameId: string, userId: string) {
    // Find the active run for this game
    const activeRun = await this.prisma.gameRun.findFirst({
      where: { gameId, status: RunStatus.ACTIVE },
    });

    if (!activeRun) {
      // Fall back to the most recent run the user participated in
      const latestSession = await this.prisma.gameSession.findFirst({
        where: { gameId, userId },
        orderBy: { startedAt: 'desc' },
        include: {
          gameRun: true,
          attempts: {
            where: { status: AttemptStatus.CORRECT },
            select: { taskId: true, pointsAwarded: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          hintUsages: { select: { hintId: true, usedAt: true, hint: { select: { taskId: true, content: true, pointPenalty: true } } } },
        },
      });

      if (!latestSession) {
        throw new NotFoundException('No session found for this game');
      }

      const totalTasks = await this.prisma.task.count({ where: { gameId } });
      return {
        session: latestSession,
        completedTasks: latestSession.attempts.length,
        totalTasks,
        progressPercent: totalTasks > 0 ? Math.round((latestSession.attempts.length / totalTasks) * 100) : 0,
        gameEnded: true,
      };
    }

    const session = await this.prisma.gameSession.findUnique({
      where: {
        gameRunId_userId: { gameRunId: activeRun.id, userId },
      },
      include: {
        attempts: {
          where: { status: AttemptStatus.CORRECT },
          select: { taskId: true, pointsAwarded: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        hintUsages: {
          select: { hintId: true, usedAt: true, hint: { select: { taskId: true, content: true, pointPenalty: true } } },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('No active session for this game');
    }

    const gameEnded = !!(activeRun.endsAt && new Date(activeRun.endsAt) < new Date());

    // If the game run has ended but the session is still ACTIVE, mark it
    if (gameEnded && session.status === SessionStatus.ACTIVE) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.TIMED_OUT, completedAt: new Date() },
      });
      session.status = SessionStatus.TIMED_OUT;
    }

    const totalTasks = await this.prisma.task.count({ where: { gameId } });
    const completedTasks = session.attempts.length;

    return {
      session,
      completedTasks,
      totalTasks,
      progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      gameEnded,
    };
  }

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
  ): Promise<TaskAttempt> {
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
    };
    const attemptStatus = statusMap[result.status] ?? AttemptStatus.ERROR;
    const pointsAwarded = Math.round(result.score * task.maxPoints);

    const attempt = await withSerializableRetry(this.prisma, async (tx) => {
      // ── Step 1: Prevent duplicate CORRECT attempts ──────────────────────────
      if (attemptStatus === AttemptStatus.CORRECT) {
        const existingCorrect = await tx.taskAttempt.findFirst({
          where: { sessionId: session.id, taskId, status: AttemptStatus.CORRECT },
        });
        if (existingCorrect) {
          throw new ConflictException('Task already completed');
        }
      }

      // Count attempts inside transaction to avoid race on attemptNumber
      const attemptCount = await tx.taskAttempt.count({
        where: { sessionId: session.id, taskId },
      });

      // ── Step 2: Create the attempt record ──────────────────────────────────
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
        },
      });

      // ── Step 3: Award points & advance session ─────────────────────────────
      if (attemptStatus === AttemptStatus.CORRECT || attemptStatus === AttemptStatus.PARTIAL) {
        const updatedSession = await tx.gameSession.update({
          where: { id: session.id },
          data: { totalPoints: { increment: pointsAwarded } },
          select: { id: true, totalPoints: true, teamId: true },
        });

        if (attemptStatus === AttemptStatus.CORRECT) {
          const nextTask = await tx.task.findFirst({
            where: {
              gameId,
              orderIndex: { gt: task.orderIndex },
            },
            orderBy: { orderIndex: 'asc' },
          });

          const sessionUpdate: Prisma.GameSessionUpdateInput = {
            currentTaskId: nextTask?.id ?? null,
            status: nextTask ? SessionStatus.ACTIVE : SessionStatus.COMPLETED,
            completedAt: nextTask ? undefined : new Date(),
          };

          if (updatedSession.teamId) {
            // Advance all team members' sessions together
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
              data: sessionUpdate,
            });
          }

          // ── Step 4: Async side effects (ranking, WS, push) ──────────────
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

    // Broadcast AI result in real-time so the mobile client gets immediate feedback
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
   * DEV-only: auto-complete a task bypassing verification.
   * Only available when DevPlayerController is registered (ENABLE_DEV_ENDPOINTS=true).
   */
  async devCompleteTask(
    gameId: string,
    taskId: string,
    userId: string,
  ): Promise<TaskAttempt> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev endpoints are disabled in production');
    }

    const session = await this.requireActiveSession(gameId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, gameId },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found in game ${gameId}`);
    }

    const pointsAwarded = task.maxPoints;

    const attempt = await withSerializableRetry(this.prisma, async (tx) => {
      // Prevent duplicate CORRECT attempts
      const existingCorrect = await tx.taskAttempt.findFirst({
        where: { sessionId: session.id, taskId, status: AttemptStatus.CORRECT },
      });
      if (existingCorrect) {
        throw new ConflictException('Task already completed');
      }

      // Count attempts inside transaction to avoid race on attemptNumber
      const attemptCount = await tx.taskAttempt.count({
        where: { sessionId: session.id, taskId },
      });

      const newAttempt = await tx.taskAttempt.create({
        data: {
          sessionId: session.id,
          taskId,
          userId,
          status: AttemptStatus.CORRECT,
          attemptNumber: attemptCount + 1,
          submission: { _dev: true } as Prisma.InputJsonValue,
          aiResult: Prisma.JsonNull,
          pointsAwarded,
        },
      });

      const updatedSession = await tx.gameSession.update({
        where: { id: session.id },
        data: { totalPoints: { increment: pointsAwarded } },
        select: { id: true, totalPoints: true, teamId: true },
      });

      const nextTask = await tx.task.findFirst({
        where: { gameId, orderIndex: { gt: task.orderIndex } },
        orderBy: { orderIndex: 'asc' },
      });

      const sessionUpdate: Prisma.GameSessionUpdateInput = {
        currentTaskId: nextTask?.id ?? null,
        status: nextTask ? SessionStatus.ACTIVE : SessionStatus.COMPLETED,
        completedAt: nextTask ? undefined : new Date(),
      };

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
          data: sessionUpdate,
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

      return newAttempt;
    });

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
    const session = await this.requireActiveSession(gameId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, gameId },
      include: { hints: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    if (task.hints.length === 0) {
      throw new BadRequestException('No hints available for this task');
    }

    const usedHintIds = (
      await this.prisma.hintUsage.findMany({
        where: { sessionId: session.id, userId },
        select: { hintId: true },
      })
    ).map((h) => h.hintId);

    const unusedHint = task.hints.find((h) => !usedHintIds.includes(h.id));

    if (!unusedHint) {
      throw new BadRequestException('All hints have already been used');
    }

    try {
      await withSerializableRetry(this.prisma, async (tx) => {
        await tx.hintUsage.create({
          data: {
            hintId: unusedHint.id,
            userId,
            sessionId: session.id,
          },
        });

        const updatedSession = await tx.gameSession.update({
          where: { id: session.id },
          data: {
            totalPoints: { decrement: unusedHint.pointPenalty },
          },
          select: { id: true, totalPoints: true },
        });

        // Clamp to zero — prevent negative scores
        if (updatedSession.totalPoints < 0) {
          await tx.gameSession.update({
            where: { id: session.id },
            data: { totalPoints: 0 },
          });
        }
      });
    } catch (error) {
      // Unique constraint on [hintId, userId, sessionId] — concurrent duplicate hint request
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Hint already in use');
      }
      throw error;
    }

    // Broadcast hint-used activity to admin monitoring
    void this.activityBroadcast.broadcastHintActivity(gameId, userId, task.title)
      .catch((err) => this.logger.error('broadcastHintActivity failed', err));

    return {
      hint: {
        content: unusedHint.content,
        pointPenalty: unusedHint.pointPenalty,
      },
    };
  }

  /**
   * Find any active session for this user across all games.
   * Used by the mobile app to restore game state on re-login.
   */
  async getMyActiveSession(userId: string) {
    const session = await this.prisma.gameSession.findFirst({
      where: { userId, status: SessionStatus.ACTIVE },
      include: {
        gameRun: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    // If the game run has ended, mark session as timed out
    if (session.gameRun.status === RunStatus.ENDED) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.TIMED_OUT, completedAt: new Date() },
      });
      return null;
    }

    // If the run expired while the user was away
    if (session.gameRun.endsAt && new Date(session.gameRun.endsAt) < new Date()) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.TIMED_OUT, completedAt: new Date() },
      });
      return null;
    }

    return {
      gameId: session.gameId,
      sessionId: session.id,
      gameRunId: session.gameRunId,
    };
  }

  /**
   * Get the user's answers for a specific past run (read-only).
   */
  async getRunAnswers(gameId: string, runNumber: number, userId: string) {
    // Resolve runNumber to a GameRun
    const gameRun = await this.prisma.gameRun.findUnique({
      where: { gameId_runNumber: { gameId, runNumber } },
    });

    if (!gameRun) {
      throw new NotFoundException('No run found with this number');
    }

    const session = await this.prisma.gameSession.findUnique({
      where: {
        gameRunId_userId: { gameRunId: gameRun.id, userId },
      },
    });

    if (!session) {
      throw new NotFoundException('No session found for this run');
    }

    const attempts = await this.prisma.taskAttempt.findMany({
      where: { sessionId: session.id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            orderIndex: true,
            maxPoints: true,
          },
        },
      },
      orderBy: [{ task: { orderIndex: 'asc' } }, { createdAt: 'asc' }],
    });

    return {
      session: {
        id: session.id,
        status: session.status,
        totalPoints: session.totalPoints,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      attempts: attempts.map((a) => ({
        taskId: a.taskId,
        taskTitle: a.task.title,
        taskDescription: a.task.description,
        taskType: a.task.type,
        maxPoints: a.task.maxPoints,
        status: a.status,
        pointsAwarded: a.pointsAwarded,
        submission: a.submission,
        aiResult: a.aiResult,
        createdAt: a.createdAt,
      })),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async requireActiveSession(gameId: string, userId: string) {
    const activeRun = await this.prisma.gameRun.findFirst({
      where: { gameId, status: RunStatus.ACTIVE },
    });

    if (!activeRun) {
      throw new ForbiddenException('This game has no active run');
    }

    const session = await this.prisma.gameSession.findUnique({
      where: {
        gameRunId_userId: { gameRunId: activeRun.id, userId },
      },
    });

    if (!session) {
      throw new NotFoundException('No session found. Start the game first.');
    }

    // Check if the game run has expired
    if (activeRun.endsAt && new Date(activeRun.endsAt) < new Date()) {
      if (session.status === SessionStatus.ACTIVE) {
        await this.prisma.gameSession.update({
          where: { id: session.id },
          data: { status: SessionStatus.TIMED_OUT, completedAt: new Date() },
        });
      }
      throw new ForbiddenException('This game run has ended');
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new ForbiddenException(`Session is ${session.status}`);
    }

    return session;
  }

  /**
   * Orchestrates post-correct-answer side effects: ranking updates, WebSocket
   * broadcasts, and push notifications. Handles both solo and team modes.
   */
}
