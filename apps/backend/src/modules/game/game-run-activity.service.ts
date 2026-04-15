import { Injectable } from '@nestjs/common';
import { AttemptStatus, RunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GameService } from './game.service';

@Injectable()
export class GameRunActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameService: GameService,
  ) {}

  /**
   * Reconstruct activity history for a run from database records.
   */
  async getRunActivity(gameId: string, runId?: string, limit = 100) {
    await this.gameService.findOne(gameId);

    const run = runId
      ? await this.prisma.gameRun.findUnique({ where: { id: runId } })
      : await this.prisma.gameRun.findFirst({ where: { gameId, status: RunStatus.ACTIVE } });

    if (!run) {
      return [];
    }

    const [sessions, attempts, hintUsages] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: { gameRunId: run.id },
        select: {
          id: true,
          startedAt: true,
          status: true,
          completedAt: true,
          user: { select: { displayName: true } },
        },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.taskAttempt.findMany({
        where: {
          session: { gameRunId: run.id },
          status: { in: [AttemptStatus.CORRECT, AttemptStatus.PARTIAL] },
        },
        select: {
          id: true,
          taskId: true,
          pointsAwarded: true,
          createdAt: true,
          status: true,
          user: { select: { displayName: true } },
          task: { select: { title: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.hintUsage.findMany({
        where: { session: { gameRunId: run.id } },
        select: {
          id: true,
          usedAt: true,
          user: { select: { displayName: true } },
          hint: { select: { task: { select: { title: true } } } },
        },
        orderBy: { usedAt: 'asc' },
      }),
    ]);

    type Activity = {
      id: string;
      timestamp: string;
      playerName: string;
      action: 'game_joined' | 'task_completed' | 'hint_used' | 'game_completed';
      details: string;
      points?: number;
    };

    const activities: Activity[] = [];

    for (const s of sessions) {
      activities.push({
        id: `join-${s.id}`,
        timestamp: s.startedAt.toISOString(),
        playerName: s.user.displayName ?? 'Player',
        action: 'game_joined',
        details: 'joined the game',
      });

      if (s.status === 'COMPLETED' && s.completedAt) {
        activities.push({
          id: `complete-${s.id}`,
          timestamp: s.completedAt.toISOString(),
          playerName: s.user.displayName ?? 'Player',
          action: 'game_completed',
          details: 'completed the game',
        });
      }
    }

    for (const a of attempts) {
      activities.push({
        id: `attempt-${a.id}`,
        timestamp: a.createdAt.toISOString(),
        playerName: a.user.displayName ?? 'Player',
        action: 'task_completed',
        details: `completed task "${a.task.title}"`,
        points: a.pointsAwarded,
      });
    }

    for (const h of hintUsages) {
      activities.push({
        id: `hint-${h.id}`,
        timestamp: h.usedAt.toISOString(),
        playerName: h.user.displayName ?? 'Player',
        action: 'hint_used',
        details: `used hint on task "${h.hint.task.title}"`,
      });
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, limit);
  }
}
