import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AttemptStatus,
  GameRun,
  Prisma,
  RunStatus,
  SessionStatus,
} from '@prisma/client';
import type { GameSettings } from '../../common/types/game-settings';
import { PrismaService } from '../../prisma/prisma.service';
import { GameService } from './game.service';
import { mapGameCounts, type GameWithCounts } from './game.utils';

@Injectable()
export class GameRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameService: GameService,
  ) {}

  /**
   * Start a new game run. The game must be PUBLISHED and have no active run.
   */
  async startRun(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameRun> {
    const game = await this.gameService.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    if (game.status !== 'PUBLISHED') {
      throw new ForbiddenException('Only published games can have runs started');
    }

    const settings = game.settings as GameSettings;

    return this.prisma.$transaction(async (tx) => {
      const existingRun = await tx.gameRun.findFirst({
        where: { gameId: id, status: RunStatus.ACTIVE },
      });

      if (existingRun) {
        throw new BadRequestException(
          'This game already has an active run. End it first before starting a new one.',
        );
      }

      const newRunNumber = game.currentRun + 1;

      const endsAt = settings.timeLimitMinutes
        ? new Date(Date.now() + settings.timeLimitMinutes * 60_000)
        : null;

      const run = await tx.gameRun.create({
        data: {
          gameId: id,
          runNumber: newRunNumber,
          status: RunStatus.ACTIVE,
          endsAt,
        },
      });

      await tx.game.update({
        where: { id },
        data: { currentRun: newRunNumber },
      });

      return run;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * End the active run for a game. All ACTIVE sessions are marked TIMED_OUT.
   */
  async endRun(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameRun> {
    const game = await this.gameService.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    return this.prisma.$transaction(async (tx) => {
      const activeRun = await tx.gameRun.findFirst({
        where: { gameId: id, status: RunStatus.ACTIVE },
      });

      if (!activeRun) {
        throw new BadRequestException('This game has no active run to end');
      }

      await tx.gameSession.updateMany({
        where: { gameRunId: activeRun.id, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.TIMED_OUT, completedAt: new Date() },
      });

      const endedRun = await tx.gameRun.update({
        where: { id: activeRun.id },
        data: { status: RunStatus.ENDED, endedAt: new Date() },
      });

      return endedRun;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Restart a published game: end the current run and start a new one.
   */
  async restartGame(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameRun> {
    const activeRun = await this.prisma.gameRun.findFirst({
      where: { gameId: id, status: RunStatus.ACTIVE },
    });

    if (activeRun) {
      await this.endRun(id, requesterId, isAdmin);
    }

    return this.startRun(id, requesterId, isAdmin);
  }

  /**
   * Get all runs for a game, ordered by runNumber descending.
   */
  async getRunHistory(gameId: string) {
    await this.gameService.findOne(gameId);

    return this.prisma.gameRun.findMany({
      where: { gameId },
      include: {
        _count: { select: { sessions: true } },
      },
      orderBy: { runNumber: 'desc' },
    });
  }

  /**
   * Get per-task completion counts for a specific run (or the active run).
   */
  async getRunTaskCompletions(gameId: string, runId?: string) {
    const run = runId
      ? await this.prisma.gameRun.findUnique({ where: { id: runId } })
      : await this.prisma.gameRun.findFirst({ where: { gameId, status: RunStatus.ACTIVE } });

    if (!run) {
      return { runId: null, completions: [] };
    }

    const correctAttempts = await this.prisma.taskAttempt.groupBy({
      by: ['taskId'],
      where: {
        task: { gameId },
        session: { gameRunId: run.id },
        status: AttemptStatus.CORRECT,
      },
      _count: true,
    });

    return {
      runId: run.id,
      completions: correctAttempts.map((a) => ({
        taskId: a.taskId,
        count: a._count,
      })),
    };
  }

  /**
   * Reconstruct activity history for a run from database records.
   */
  async getRunActivity(gameId: string, runId?: string, limit = 100) {
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

  /**
   * Get games that currently have an active run (for admin dashboard).
   */
  async getRunningGames(): Promise<GameWithCounts[]> {
    const games = await this.prisma.game.findMany({
      where: {
        runs: { some: { status: RunStatus.ACTIVE } },
      },
      include: {
        creator: { select: { id: true, displayName: true } },
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return games.map((g) => mapGameCounts(g));
  }
}
