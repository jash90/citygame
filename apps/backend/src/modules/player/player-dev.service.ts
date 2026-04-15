import { Logger } from '@nestjs/common';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  Prisma,
  RunStatus,
  SessionStatus,
  TaskAttempt,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withSerializableRetry } from '../../common/utils/prisma-retry';
import { ActivityBroadcastService } from './activity-broadcast.service';

@Injectable()
export class PlayerDevService {
  private readonly logger = new Logger(PlayerDevService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityBroadcast: ActivityBroadcastService,
  ) {}

  /**
   * DEV-only: auto-complete a task bypassing verification.
   * Only available when DevPlayerController is registered (ENABLE_DEV_ENDPOINTS=true).
   */
  async devCompleteTask(
    gameId: string,
    taskId: string,
    userId: string,
  ): Promise<TaskAttempt> {
    const activeRun = await this.prisma.gameRun.findFirst({
      where: { gameId, status: RunStatus.ACTIVE },
    });

    if (!activeRun) {
      throw new ForbiddenException('This game has no active run');
    }

    const session = await this.prisma.gameSession.findUnique({
      where: { gameRunId_userId: { gameRunId: activeRun.id, userId } },
    });

    if (!session) {
      throw new NotFoundException('No session found. Start the game first.');
    }

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

    const task = await this.prisma.task.findFirst({ where: { id: taskId, gameId } });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found in game ${gameId}`);
    }

    const pointsAwarded = task.maxPoints;

    return withSerializableRetry(this.prisma, async (tx) => {
      const existingCorrect = await tx.taskAttempt.findFirst({
        where: { sessionId: session.id, taskId, status: AttemptStatus.CORRECT },
      });
      if (existingCorrect) {
        throw new ConflictException('Task already completed');
      }

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

      return newAttempt;
    });
  }
}
