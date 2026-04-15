import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RunStatus,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withSerializableRetry } from '../../common/utils/prisma-retry';
import { ActivityBroadcastService } from './activity-broadcast.service';

@Injectable()
export class PlayerHintService {
  private readonly logger = new Logger(PlayerHintService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityBroadcast: ActivityBroadcastService,
  ) {}

  /**
   * Resolve an active game session for a user in a game.
   * Throws if no active run exists or the session is not active.
   */
  async requireActiveSession(gameId: string, userId: string) {
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

    return session;
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
          data: { hintId: unusedHint.id, userId, sessionId: session.id },
        });

        const updatedSession = await tx.gameSession.update({
          where: { id: session.id },
          data: { totalPoints: { decrement: unusedHint.pointPenalty } },
          select: { id: true, totalPoints: true },
        });

        if (updatedSession.totalPoints < 0) {
          await tx.gameSession.update({
            where: { id: session.id },
            data: { totalPoints: 0 },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Hint already in use');
      }
      throw error;
    }

    void this.activityBroadcast.broadcastHintActivity(gameId, userId, task.title)
      .catch((err) => this.logger.error('broadcastHintActivity failed', err));

    return {
      hint: { content: unusedHint.content, pointPenalty: unusedHint.pointPenalty },
    };
  }
}
