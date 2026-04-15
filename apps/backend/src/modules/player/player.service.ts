import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GameSession,
  GameStatus,
  RunStatus,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withSerializableRetry } from '../../common/utils/prisma-retry';
import { TeamService } from '../team/team.service';
import type { GameSettings } from '../../common/types/game-settings';
import { ActivityBroadcastService } from './activity-broadcast.service';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamService: TeamService,
    private readonly activityBroadcast: ActivityBroadcastService,
  ) {}

  /**
   * Start a new game session for the authenticated user.
   * In team mode, the user must be in a team. All team members share one session —
   * if the team session already exists, it is returned directly.
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

    if (activeRun.endsAt && new Date(activeRun.endsAt) < new Date()) {
      throw new ForbiddenException('This game run has ended');
    }

    const settings = game.settings as GameSettings;

    if (settings.teamMode) {
      return this.startTeamGame(gameId, userId, game.tasks[0]?.id ?? null, activeRun.id);
    }

    const existingSession = await this.prisma.gameSession.findUnique({
      where: { gameRunId_userId: { gameRunId: activeRun.id, userId } },
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

    void this.activityBroadcast.broadcastJoinActivity(gameId, userId)
      .catch((err) => this.logger.error('broadcastJoinActivity failed', err));

    return session;
  }

  private async startTeamGame(
    gameId: string,
    userId: string,
    firstTaskId: string | null,
    gameRunId: string,
  ): Promise<GameSession> {
    const membership = await this.teamService.findMembership(gameId, userId);

    if (!membership) {
      throw new BadRequestException('You must join a team before starting this game');
    }

    const { teamId } = membership;

    const session = await withSerializableRetry(this.prisma, async (tx) => {
      const existingTeamSession = await tx.gameSession.findFirst({
        where: { gameId, teamId, gameRunId },
      });

      if (existingTeamSession) {
        if (existingTeamSession.status === SessionStatus.ACTIVE) {
          const userSession = await tx.gameSession.findUnique({
            where: { gameRunId_userId: { gameRunId, userId } },
          });
          if (!userSession) {
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
}
