import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  GameSession,
  GameStatus,
  Prisma,
  SessionStatus,
  TaskAttempt,
  TaskType,
  UnlockMethod,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { RankingGateway } from '../ranking/ranking.gateway';
import { RankingService } from '../ranking/ranking.service';
import { TeamService } from '../team/team.service';
import { VerificationService } from '../task/verification/verification.service';

type GameSettings = {
  teamMode?: boolean;
};

const AI_TASK_TYPES = new Set<TaskType>([
  TaskType.PHOTO_AI,
  TaskType.TEXT_AI,
  TaskType.AUDIO_AI,
]);

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
    private readonly rankingService: RankingService,
    private readonly rankingGateway: RankingGateway,
    private readonly notificationService: NotificationService,
    private readonly teamService: TeamService,
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
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    if (game.status !== GameStatus.PUBLISHED) {
      throw new ForbiddenException('This game is not available for play');
    }

    const settings = game.settings as GameSettings;

    if (settings.teamMode) {
      return this.startTeamGame(gameId, userId, game.tasks[0]?.id ?? null);
    }

    const existingSession = await this.prisma.gameSession.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });

    if (existingSession) {
      if (existingSession.status === SessionStatus.ACTIVE) {
        return existingSession;
      }
      throw new ConflictException('You have already played this game');
    }

    const session = await this.prisma.gameSession.create({
      data: {
        gameId,
        userId,
        status: SessionStatus.ACTIVE,
        currentTaskId: game.tasks[0]?.id ?? null,
      },
    });

    // Broadcast join activity to admin monitoring
    void this.broadcastJoinActivity(gameId, userId);

    return session;
  }

  /**
   * Handle session start for a team-mode game.
   * The first team member to call startGame creates the shared session;
   * subsequent members receive the existing active session.
   */
  private async startTeamGame(
    gameId: string,
    userId: string,
    firstTaskId: string | null,
  ): Promise<GameSession> {
    const membership = await this.teamService.findMembership(gameId, userId);

    if (!membership) {
      throw new BadRequestException(
        'You must join a team before starting this game',
      );
    }

    const { teamId } = membership;

    // Check if any team member already has a session — shared team session
    const existingTeamSession = await this.prisma.gameSession.findFirst({
      where: { gameId, teamId },
    });

    if (existingTeamSession) {
      if (existingTeamSession.status === SessionStatus.ACTIVE) {
        // Ensure requesting user also has their own row pointing to the shared session data
        const userSession = await this.prisma.gameSession.findUnique({
          where: { gameId_userId: { gameId, userId } },
        });
        if (!userSession) {
          // Create a personal session row linked to the same team
          const newUserSession = await this.prisma.gameSession.create({
            data: {
              gameId,
              userId,
              teamId,
              status: SessionStatus.ACTIVE,
              totalPoints: existingTeamSession.totalPoints,
              currentTaskId: existingTeamSession.currentTaskId,
            },
          });
          void this.broadcastJoinActivity(gameId, userId);
          return newUserSession;
        }
        return userSession;
      }
      throw new ConflictException('Your team has already played this game');
    }

    // Create session for the first team member joining
    const session = await this.prisma.gameSession.create({
      data: {
        gameId,
        userId,
        teamId,
        status: SessionStatus.ACTIVE,
        currentTaskId: firstTaskId,
      },
    });

    void this.broadcastJoinActivity(gameId, userId);

    return session;
  }

  /**
   * Get the player's current progress: session, completed tasks, hint usages.
   */
  async getProgress(gameId: string, userId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { gameId_userId: { gameId, userId } },
      include: {
        attempts: {
          where: { status: AttemptStatus.CORRECT },
          select: { taskId: true, pointsAwarded: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        hintUsages: {
          select: { hintId: true, usedAt: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('No active session for this game');
    }

    const totalTasks = await this.prisma.task.count({ where: { gameId } });
    const completedTasks = session.attempts.length;

    return {
      session,
      completedTasks,
      totalTasks,
      progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
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
    const session = await this.requireActiveSession(gameId, userId);

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

      const distance = this.haversineDistance(playerLat, playerLng, targetLat, targetLng);
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

    const attemptCount = await this.prisma.taskAttempt.count({
      where: { sessionId: session.id, taskId },
    });

    const result = await this.verificationService.verify(task, submission);

    const statusMap: Record<string, AttemptStatus> = {
      CORRECT: AttemptStatus.CORRECT,
      INCORRECT: AttemptStatus.INCORRECT,
      PARTIAL: AttemptStatus.PARTIAL,
      ERROR: AttemptStatus.ERROR,
    };
    const attemptStatus = statusMap[result.status] ?? AttemptStatus.ERROR;
    const pointsAwarded = Math.round(result.score * task.maxPoints);

    const attempt = await this.prisma.$transaction(async (tx) => {
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

          // Async: ranking update, WebSocket broadcasts, push notifications
          void this.handlePostCorrect(
            gameId,
            userId,
            taskId,
            task.title,
            pointsAwarded,
            updatedSession.totalPoints,
            updatedSession.teamId ?? null,
            newAttempt.id,
          );
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

    await this.prisma.$transaction(async (tx) => {
      await tx.hintUsage.create({
        data: {
          hintId: unusedHint.id,
          userId,
          sessionId: session.id,
        },
      });

      await tx.gameSession.update({
        where: { id: session.id },
        data: {
          totalPoints: { decrement: unusedHint.pointPenalty },
        },
      });
    });

    // Broadcast hint-used activity to admin monitoring
    void this.broadcastHintActivity(gameId, userId, task.title);

    return {
      hint: {
        content: unusedHint.content,
        pointPenalty: unusedHint.pointPenalty,
      },
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async requireActiveSession(gameId: string, userId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });

    if (!session) {
      throw new NotFoundException('No session found. Start the game first.');
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
  private async handlePostCorrect(
    gameId: string,
    userId: string,
    taskId: string,
    taskTitle: string,
    pointsAwarded: number,
    totalPoints: number,
    teamId: string | null,
    attemptId: string,
  ): Promise<void> {
    if (teamId) {
      await this.rankingService.updateTeamScore(gameId, teamId, totalPoints);
      const teamRanking = await this.rankingService.getTeamRanking(gameId);

      // Retrieve team name for the broadcast payload
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { name: true },
      });

      this.rankingGateway.broadcastTeamUpdate(gameId, {
        gameId,
        teamId,
        teamName: team?.name ?? teamId,
        ranking: teamRanking,
      });

      this.rankingGateway.broadcastPlayerCompletedTask({
        gameId,
        userId,
        taskId,
        pointsAwarded,
        totalPoints,
      });
    } else {
      await this.rankingService.updateScore(gameId, userId, totalPoints);
      const ranking = await this.rankingService.getRanking(gameId);
      this.rankingGateway.broadcastRankingUpdate(gameId, ranking);
      this.rankingGateway.broadcastPlayerCompletedTask({
        gameId,
        userId,
        taskId,
        pointsAwarded,
        totalPoints,
      });

      await this.notifyTopRankingChanges(gameId, ranking);
    }

    await this.onTaskCorrect(gameId, userId, taskId, taskTitle, pointsAwarded, attemptId, teamId);
  }

  /**
   * After a correct answer: broadcast activity and push notifications to other
   * active players (or team members) in the game.
   */
  private async onTaskCorrect(
    gameId: string,
    userId: string,
    taskId: string,
    taskTitle: string,
    pointsAwarded: number,
    attemptId: string,
    teamId: string | null,
  ): Promise<void> {
    const player = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    const playerName = player?.displayName ?? 'Gracz';

    this.rankingGateway.broadcastActivity(gameId, {
      type: 'task_completed',
      playerName,
      details: `ukończył zadanie "${taskTitle}"`,
      points: pointsAwarded,
      taskId,
    });

    // Push notifications to other active players (excluding the current user's team in team mode)
    const otherSessionsWhere: Prisma.GameSessionWhereInput = {
      gameId,
      status: SessionStatus.ACTIVE,
      userId: { not: userId },
      ...(teamId ? {} : { teamId: null }),
    };

    const otherSessions = await this.prisma.gameSession.findMany({
      where: otherSessionsWhere,
      select: { userId: true },
    });

    if (otherSessions.length > 0) {
      const otherUserIds = otherSessions.map((s) => s.userId);
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: otherUserIds },
          pushToken: { not: null },
        },
        select: { pushToken: true },
      });

      const tokens = users.map((u) => u.pushToken).filter((t): t is string => t !== null);

      if (tokens.length > 0) {
        await this.notificationService.sendToMultiple(
          tokens,
          'Nowe osiągnięcie',
          `${playerName} ukończył zadanie "${taskTitle}"! (+${pointsAwarded} pkt)`,
          { gameId, type: 'task_completed', attemptId },
        );
      }
    }

    // In team mode, notify team members about the completion
    if (teamId) {
      await this.notifyTeamMembers(gameId, teamId, userId, playerName, taskTitle, pointsAwarded, attemptId);
    }
  }

  /**
   * Push notification to team members (excluding the solver) that their teammate
   * completed a task.
   */
  private async notifyTeamMembers(
    gameId: string,
    teamId: string,
    solverId: string,
    solverName: string,
    taskTitle: string,
    pointsAwarded: number,
    attemptId: string,
  ): Promise<void> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId, userId: { not: solverId } },
      include: {
        user: { select: { pushToken: true } },
      },
    });

    const tokens = members
      .map((m) => m.user.pushToken)
      .filter((t): t is string => t !== null);

    if (tokens.length > 0) {
      await this.notificationService.sendToMultiple(
        tokens,
        'Twój zespół zdobył punkty!',
        `${solverName} ukończył zadanie "${taskTitle}"! (+${pointsAwarded} pkt)`,
        { gameId, teamId, type: 'team_task_completed', attemptId },
      );
    }
  }

  /**
   * Notify players in the top 3 whose position may have changed.
   */
  private async notifyTopRankingChanges(
    gameId: string,
    ranking: { userId: string; score: number; rank: number }[],
  ): Promise<void> {
    const top3 = ranking.slice(0, 3);
    if (top3.length === 0) return;

    const top3UserIds = top3.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: top3UserIds },
        pushToken: { not: null },
      },
      select: { id: true, pushToken: true, displayName: true },
    });

    for (const user of users) {
      if (!user.pushToken) continue;
      const entry = top3.find((r) => r.userId === user.id);
      if (!entry) continue;

      await this.notificationService.sendPushNotification(
        user.pushToken,
        'Ranking zaktualizowany',
        `Jesteś na miejscu #${entry.rank} z wynikiem ${entry.score} pkt!`,
        { gameId, type: 'ranking_update', rank: entry.rank },
      );
    }
  }

  private async broadcastJoinActivity(gameId: string, userId: string): Promise<void> {
    const player = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    this.rankingGateway.broadcastActivity(gameId, {
      type: 'game_joined',
      playerName: player?.displayName ?? 'Gracz',
      details: 'dołączył do gry',
    });
  }

  private async broadcastHintActivity(
    gameId: string,
    userId: string,
    taskTitle: string,
  ): Promise<void> {
    const player = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    this.rankingGateway.broadcastActivity(gameId, {
      type: 'hint_used',
      playerName: player?.displayName ?? 'Gracz',
      details: `użył podpowiedzi w zadaniu "${taskTitle}"`,
    });
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
