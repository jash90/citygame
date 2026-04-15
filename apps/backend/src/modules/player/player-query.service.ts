import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RunStatus, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlayerQueryService {
  private readonly logger = new Logger(PlayerQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the player's current progress: session, completed tasks, hint usages.
   */
  async getProgress(gameId: string, userId: string) {
    const activeRun = await this.prisma.gameRun.findFirst({
      where: { gameId, status: RunStatus.ACTIVE },
    });

    if (!activeRun) {
      const latestSession = await this.prisma.gameSession.findFirst({
        where: { gameId, userId },
        orderBy: { startedAt: 'desc' },
        include: {
          gameRun: true,
          attempts: {
            where: { status: 'CORRECT' },
            select: { taskId: true, pointsAwarded: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          hintUsages: {
            select: {
              hintId: true,
              usedAt: true,
              hint: { select: { taskId: true, content: true, pointPenalty: true } },
            },
          },
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
        progressPercent: totalTasks > 0
          ? Math.round((latestSession.attempts.length / totalTasks) * 100)
          : 0,
        gameEnded: true,
      };
    }

    const session = await this.prisma.gameSession.findUnique({
      where: { gameRunId_userId: { gameRunId: activeRun.id, userId } },
      include: {
        attempts: {
          where: { status: 'CORRECT' },
          select: { taskId: true, pointsAwarded: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        hintUsages: {
          select: {
            hintId: true,
            usedAt: true,
            hint: { select: { taskId: true, content: true, pointPenalty: true } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('No active session for this game');
    }

    const gameEnded = !!(activeRun.endsAt && new Date(activeRun.endsAt) < new Date());

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
   * Find any active session for this user across all games.
   * Used by the mobile app to restore game state on re-login.
   */
  async getMyActiveSession(userId: string) {
    const session = await this.prisma.gameSession.findFirst({
      where: { userId, status: SessionStatus.ACTIVE },
      include: { gameRun: true },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    if (session.gameRun.status === RunStatus.ENDED) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.TIMED_OUT, completedAt: new Date() },
      });
      return null;
    }

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
    const gameRun = await this.prisma.gameRun.findUnique({
      where: { gameId_runNumber: { gameId, runNumber } },
    });

    if (!gameRun) {
      throw new NotFoundException('No run found with this number');
    }

    const session = await this.prisma.gameSession.findUnique({
      where: { gameRunId_userId: { gameRunId: gameRun.id, userId } },
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
}
