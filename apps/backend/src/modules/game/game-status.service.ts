import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  GameStatus,
  Prisma,
  RunStatus,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GameService } from './game.service';
import { mapGameCounts, type GameWithCounts } from './game.utils';

@Injectable()
export class GameStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameService: GameService,
  ) {}

  /**
   * Transition a DRAFT game to PUBLISHED.
   */
  async publish(id: string, requesterId: string, isAdmin: boolean): Promise<GameWithCounts> {
    const game = await this.gameService.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    if (game.status !== GameStatus.DRAFT) {
      throw new ForbiddenException(`Game is already ${game.status}`);
    }

    const updated = await this.prisma.game.update({
      where: { id },
      data: { status: GameStatus.PUBLISHED },
      include: {
        creator: { select: { id: true, displayName: true } },
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    return mapGameCounts(updated);
  }

  /**
   * Revert a PUBLISHED game back to DRAFT. Blocked if active sessions exist.
   */
  async unpublish(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameWithCounts> {
    const game = await this.gameService.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    if (game.status !== GameStatus.PUBLISHED) {
      throw new ForbiddenException(
        `Can only unpublish PUBLISHED games, current status: ${game.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const activeRun = await tx.gameRun.findFirst({
        where: { gameId: id, status: RunStatus.ACTIVE },
      });

      if (activeRun) {
        throw new BadRequestException(
          'Cannot unpublish game with an active run. End the run first.',
        );
      }

      const activeSessions = await tx.gameSession.count({
        where: { gameId: id, status: SessionStatus.ACTIVE },
      });

      if (activeSessions > 0) {
        throw new BadRequestException(
          `Cannot unpublish game with ${activeSessions} active session(s)`,
        );
      }

      const updated = await tx.game.update({
        where: { id },
        data: { status: GameStatus.DRAFT },
        include: {
          creator: { select: { id: true, displayName: true } },
          runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
          _count: { select: { tasks: true, sessions: true } },
        },
      });

      return mapGameCounts(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Archive a game (any non-ARCHIVED status).
   */
  async archive(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameWithCounts> {
    const game = await this.gameService.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    if (game.status === GameStatus.ARCHIVED) {
      throw new ForbiddenException('Game is already archived');
    }

    const updated = await this.prisma.game.update({
      where: { id },
      data: { status: GameStatus.ARCHIVED },
      include: {
        creator: { select: { id: true, displayName: true } },
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    return mapGameCounts(updated);
  }
}
