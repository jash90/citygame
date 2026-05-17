import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Game,
  GameStatus,
  Prisma,
  RunStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Strip secrets from `verifyConfig` for online task delivery to players.
 * Exposes media URLs (player needs them to render the puzzle) and rubrics
 * (PRACTICAL criteria are public context) but never the expected answer,
 * AI prompt, threshold or any hashes.
 */
function sanitizePlayerVerifyConfig(
  type: TaskType,
  raw: unknown,
): Record<string, unknown> {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  switch (type) {
    case TaskType.AUDIO: {
      const out: Record<string, unknown> = { mode: cfg.mode ?? 'EXACT' };
      if (typeof cfg.audioUrl === 'string') out.audioUrl = cfg.audioUrl;
      return out;
    }
    case TaskType.PHOTO: {
      const out: Record<string, unknown> = { mode: cfg.mode ?? 'EXACT' };
      if (typeof cfg.imageUrl === 'string') out.imageUrl = cfg.imageUrl;
      return out;
    }
    case TaskType.VIDEO: {
      const out: Record<string, unknown> = { mode: cfg.mode ?? 'EXACT' };
      if (typeof cfg.videoUrl === 'string') out.videoUrl = cfg.videoUrl;
      return out;
    }
    case TaskType.PRACTICAL: {
      const out: Record<string, unknown> = {};
      if (typeof cfg.criteria === 'string') out.criteria = cfg.criteria;
      return out;
    }
    default:
      return {};
  }
}

import { CreateGameDto } from './dto/create-game.dto';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { mapGameCounts, type GameWithCounts } from './game.utils';
export type { GameWithCounts };

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
          runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
          _count: { select: { tasks: true, sessions: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);

    const items = raw.map((g) => mapGameCounts(g));

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
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${id} not found`);
    }

    return mapGameCounts(game);
  }

  /**
   * Player-facing: find a published game without sensitive task details.
   */
  async findOnePublic(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id, status: GameStatus.PUBLISHED },
      include: {
        creator: { select: { id: true, displayName: true } },
        tasks: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            unlockMethod: true,
            orderIndex: true,
            latitude: true,
            longitude: true,
            maxPoints: true,
            timeLimitSec: true,
            storyContext: true,
            verifyConfig: true,
            _count: { select: { hints: true } },
          },
        },
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${id} not found`);
    }

    const { _count, runs, tasks, ...rest } = game;
    return {
      ...rest,
      tasks: tasks.map((t) => ({
        ...t,
        verifyConfig: sanitizePlayerVerifyConfig(t.type, t.verifyConfig),
      })),
      activeRun: runs[0] ?? null,
      taskCount: _count.tasks,
      playerCount: _count.sessions,
    };
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
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    return mapGameCounts(updated);
  }

  /**
   * Delete a game. Blocked if sessions exist (no cascade on GameSession).
   */
  async delete(id: string, requesterId: string, isAdmin: boolean): Promise<void> {
    const game = await this.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    await this.prisma.$transaction(async (tx) => {
      const sessionCount = await tx.gameSession.count({
        where: { gameId: id },
      });

      if (sessionCount > 0) {
        throw new BadRequestException(
          `Cannot delete game with ${sessionCount} existing session(s). Archive it instead.`,
        );
      }

      await tx.game.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Get sessions for a game (admin monitoring). Supports pagination.
   */
  async getGameSessions(gameId: string, runId?: string, page = 1, limit = 50) {
    await this.findOne(gameId);

    const skip = (page - 1) * limit;
    const where: Prisma.GameSessionWhereInput = { gameId };
    if (runId) {
      where.gameRunId = runId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.gameSession.findMany({
        where,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          gameRun: { select: { runNumber: true, status: true } },
          _count: { select: { attempts: true } },
        },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.gameSession.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
