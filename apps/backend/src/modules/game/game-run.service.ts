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
