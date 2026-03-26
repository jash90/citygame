import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttemptStatus, Game, GameStatus, Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { UpdateGameDto } from './dto/update-game.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Game record enriched with flat count fields expected by the frontend. */
export type GameWithCounts = Game & {
  taskCount: number;
  playerCount: number;
  creator: { id: string; displayName: string | null };
};

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List games with optional filtering and pagination.
   * Admin can see all statuses; players only see PUBLISHED.
   */
  async findAll(
    query: ListGamesQueryDto,
    adminMode = false,
  ): Promise<PaginatedResult<GameWithCounts>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.GameWhereInput = {};

    if (!adminMode) {
      where.status = GameStatus.PUBLISHED;
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' };
    }

    const [raw, total] = await this.prisma.$transaction([
      this.prisma.game.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, displayName: true } },
          _count: { select: { tasks: true, sessions: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);

    const items = raw.map((g) => this.mapCounts(g));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single game by id. Returns the full game with flat task/player counts.
   */
  async findOne(id: string): Promise<GameWithCounts> {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, displayName: true } },
        tasks: {
          orderBy: { orderIndex: 'asc' },
          include: { hints: { orderBy: { orderIndex: 'asc' } } },
        },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${id} not found`);
    }

    return this.mapCounts(game);
  }

  /**
   * Create a new game draft. CreatorId comes from the authenticated user.
   */
  async create(dto: CreateGameDto, creatorId: string): Promise<Game> {
    return this.prisma.game.create({
      data: {
        title: dto.title,
        description: dto.description,
        city: dto.city,
        coverImageUrl: dto.coverImageUrl,
        settings: dto.settings as Prisma.InputJsonValue,
        creatorId,
        status: GameStatus.DRAFT,
      },
    });
  }

  /**
   * Update a game. Only the creator or an admin can update.
   */
  async update(
    id: string,
    dto: UpdateGameDto,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameWithCounts> {
    const game = await this.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    const data: Prisma.GameUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.settings !== undefined) data.settings = dto.settings as Prisma.InputJsonValue;

    const updated = await this.prisma.game.update({
      where: { id },
      data,
      include: {
        creator: { select: { id: true, displayName: true } },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    return this.mapCounts(updated);
  }

  /**
   * Delete a game. Cascades to tasks via Prisma schema.
   */
  async delete(id: string, requesterId: string, isAdmin: boolean): Promise<void> {
    const game = await this.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    await this.prisma.game.delete({ where: { id } });
  }

  /**
   * Transition a DRAFT game to PUBLISHED.
   */
  async publish(id: string, requesterId: string, isAdmin: boolean): Promise<GameWithCounts> {
    const game = await this.findOne(id);

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
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    return this.mapCounts(updated);
  }

  /**
   * Get all sessions for a game (admin monitoring), enriched with user info
   * and per-session attempt counts.
   */
  async getGameSessions(gameId: string) {
    await this.findOne(gameId);

    return this.prisma.gameSession.findMany({
      where: { gameId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Aggregate game statistics for the admin dashboard.
   */
  async getGameStats(gameId: string) {
    await this.findOne(gameId);

    const [sessions, tasks] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: { gameId },
        select: { status: true },
      }),
      this.prisma.task.findMany({
        where: { gameId },
        select: {
          id: true,
          title: true,
          attempts: {
            select: { status: true },
          },
        },
      }),
    ]);

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => s.status === SessionStatus.ACTIVE).length;
    const completedSessions = sessions.filter((s) => s.status === SessionStatus.COMPLETED).length;

    const totalAttempts = tasks.reduce((sum: number, t) => sum + t.attempts.length, 0);

    const avgCompletionRate =
      tasks.length > 0
        ? tasks.reduce((sum: number, t) => {
            const correct = t.attempts.filter((a) => a.status === AttemptStatus.CORRECT).length;
            const total = t.attempts.length;
            return sum + (total > 0 ? correct / total : 0);
          }, 0) / tasks.length
        : 0;

    const taskCompletionRates = tasks.map((t) => {
      const completedCount = t.attempts.filter((a) => a.status === AttemptStatus.CORRECT).length;
      return {
        taskId: t.id,
        title: t.title,
        completedCount,
        totalAttempts: t.attempts.length,
      };
    });

    return {
      totalSessions,
      activeSessions,
      completedSessions,
      totalAttempts,
      avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
      taskCompletionRates,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private mapCounts(
    game: Game & {
      creator: { id: string; displayName: string | null };
      _count: { tasks: number; sessions: number };
    },
  ): GameWithCounts {
    const { _count, ...rest } = game;
    return {
      ...rest,
      taskCount: _count.tasks,
      playerCount: _count.sessions,
    };
  }
}
