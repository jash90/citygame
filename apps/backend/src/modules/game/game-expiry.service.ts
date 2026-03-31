import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RunStatus, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class GameExpiryService {
  private readonly logger = new Logger(GameExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Runs every minute. Finds active GameRuns whose endsAt has passed
   * and marks all remaining ACTIVE sessions as TIMED_OUT, then ends the run.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredRuns(): Promise<void> {
    const now = new Date();

    // Find active runs that have expired and still have active sessions
    const expiredRuns = await this.prisma.gameRun.findMany({
      where: {
        status: RunStatus.ACTIVE,
        endsAt: { lte: now },
        sessions: {
          some: { status: SessionStatus.ACTIVE },
        },
      },
      select: {
        id: true,
        runNumber: true,
        game: { select: { id: true, title: true } },
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          select: {
            id: true,
            userId: true,
            user: { select: { pushToken: true } },
          },
        },
      },
    });

    if (expiredRuns.length === 0) return;

    for (const run of expiredRuns) {
      const sessionIds = run.sessions.map((s) => s.id);

      // Bulk-update sessions to TIMED_OUT
      const { count } = await this.prisma.gameSession.updateMany({
        where: { id: { in: sessionIds } },
        data: {
          status: SessionStatus.TIMED_OUT,
          completedAt: now,
        },
      });

      // End the run
      await this.prisma.gameRun.update({
        where: { id: run.id },
        data: { status: RunStatus.ENDED, endedAt: now },
      });

      this.logger.log(
        `Game "${run.game.title}" (run ${run.runNumber}) expired — ${count} session(s) timed out`,
      );

      // Send push notifications to affected players
      const tokens = run.sessions
        .map((s) => s.user.pushToken)
        .filter((t): t is string => t !== null);

      if (tokens.length > 0) {
        await this.notificationService.sendToMultiple(
          tokens,
          'Gra zakończona',
          `Czas gry "${run.game.title}" upłynął! Sprawdź swoje wyniki.`,
          { gameId: run.game.id, type: 'game_expired' },
        );
      }
    }

    // Also end any active runs with no active sessions that have expired
    await this.prisma.gameRun.updateMany({
      where: {
        status: RunStatus.ACTIVE,
        endsAt: { lte: now },
        sessions: { none: { status: SessionStatus.ACTIVE } },
      },
      data: { status: RunStatus.ENDED, endedAt: now },
    });
  }
}
