import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  Game,
  GameRun,
  GameStatus,
  Prisma,
  RunStatus,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { UpdateGameDto } from './dto/update-game.dto';

type GameSettings = {
  timeLimitMinutes?: number;
  [key: string]: unknown;
};

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
  activeRun: GameRun | null;
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
          runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
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
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${id} not found`);
    }

    return this.mapCounts(game);
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

    const { _count, runs, ...rest } = game;
    return {
      ...rest,
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

    return this.mapCounts(updated);
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
   * Transition a DRAFT game to PUBLISHED.
   */
  /**
   * Transition a DRAFT game to PUBLISHED.
   * The game becomes visible to players but is NOT joinable until a run is started.
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
        runs: { where: { status: RunStatus.ACTIVE }, take: 1 },
        _count: { select: { tasks: true, sessions: true } },
      },
    });

    return this.mapCounts(updated);
  }

  /**
   * Start a new game run. The game must be PUBLISHED and have no active run.
   * Creates a GameRun with a timer based on settings.timeLimitMinutes.
   */
  async startRun(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameRun> {
    const game = await this.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    if (game.status !== GameStatus.PUBLISHED) {
      throw new ForbiddenException('Only published games can have runs started');
    }

    const settings = game.settings as GameSettings;

    return this.prisma.$transaction(async (tx) => {
      // Check for existing active run (also enforced by partial unique index)
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
    const game = await this.findOne(id);

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

      // Mark all active sessions as timed out
      await tx.gameSession.updateMany({
        where: { gameRunId: activeRun.id, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.TIMED_OUT, completedAt: new Date() },
      });

      // End the run
      const endedRun = await tx.gameRun.update({
        where: { id: activeRun.id },
        data: { status: RunStatus.ENDED, endedAt: new Date() },
      });

      return endedRun;
    });
  }

  /**
   * Get all runs for a game, ordered by runNumber descending.
   */
  async getRunHistory(gameId: string) {
    await this.findOne(gameId);

    return this.prisma.gameRun.findMany({
      where: { gameId },
      include: {
        _count: { select: { sessions: true } },
      },
      orderBy: { runNumber: 'desc' },
    });
  }

  /**
   * Get all sessions for a game (admin monitoring), enriched with user info
   * and per-session attempt counts.
   */
  async getGameSessions(gameId: string, runId?: string) {
    await this.findOne(gameId);

    const where: Prisma.GameSessionWhereInput = { gameId };
    if (runId) {
      where.gameRunId = runId;
    }

    return this.prisma.gameSession.findMany({
      where,
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
        gameRun: { select: { runNumber: true, status: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Get per-task completion counts for a specific run (or the active run).
   * Used by the monitor to show initial progress.
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
   * Returns join events, task completions, and hint usages ordered by time.
   */
  async getRunActivity(gameId: string, runId?: string) {
    const run = runId
      ? await this.prisma.gameRun.findUnique({ where: { id: runId } })
      : await this.prisma.gameRun.findFirst({ where: { gameId, status: RunStatus.ACTIVE } });

    if (!run) {
      return [];
    }

    // Fetch sessions (join events), correct attempts (completions), and hint usages
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

    // Join events
    for (const s of sessions) {
      activities.push({
        id: `join-${s.id}`,
        timestamp: s.startedAt.toISOString(),
        playerName: s.user.displayName ?? 'Gracz',
        action: 'game_joined',
        details: 'dołączył do gry',
      });

      // Completed game event
      if (s.status === 'COMPLETED' && s.completedAt) {
        activities.push({
          id: `complete-${s.id}`,
          timestamp: s.completedAt.toISOString(),
          playerName: s.user.displayName ?? 'Gracz',
          action: 'game_completed',
          details: 'ukończył grę',
        });
      }
    }

    // Task completion events
    for (const a of attempts) {
      activities.push({
        id: `attempt-${a.id}`,
        timestamp: a.createdAt.toISOString(),
        playerName: a.user.displayName ?? 'Gracz',
        action: 'task_completed',
        details: `ukończył zadanie "${a.task.title}"`,
        points: a.pointsAwarded,
      });
    }

    // Hint usage events
    for (const h of hintUsages) {
      activities.push({
        id: `hint-${h.id}`,
        timestamp: h.usedAt.toISOString(),
        playerName: h.user.displayName ?? 'Gracz',
        action: 'hint_used',
        details: `użył podpowiedzi w zadaniu "${h.hint.task.title}"`,
      });
    }

    // Sort by timestamp descending (newest first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, 100);
  }

  /**
   * Aggregate game statistics for the admin dashboard.
   */
  async getGameStats(gameId: string, runId?: string) {
    await this.findOne(gameId);

    const sessionWhere: Prisma.GameSessionWhereInput = { gameId };
    if (runId) sessionWhere.gameRunId = runId;

    const attemptWhere: Prisma.TaskAttemptWhereInput = { task: { gameId } };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const [sessionStats, totalAttempts, tasks, correctByTask] = await Promise.all([
      this.prisma.gameSession.groupBy({
        by: ['status'],
        where: sessionWhere,
        _count: true,
      }),
      this.prisma.taskAttempt.count({
        where: attemptWhere,
      }),
      this.prisma.task.findMany({
        where: { gameId },
        select: {
          id: true,
          title: true,
        },
      }),
      this.prisma.taskAttempt.groupBy({
        by: ['taskId'],
        where: { ...attemptWhere, status: AttemptStatus.CORRECT },
        _count: true,
      }),
    ]);

    // Count per-task attempts within scope (run-filtered)
    const attemptsByTask = await this.prisma.taskAttempt.groupBy({
      by: ['taskId'],
      where: attemptWhere,
      _count: true,
    });
    const attemptsByTaskMap = new Map(attemptsByTask.map((a) => [a.taskId, a._count]));

    const totalSessions = sessionStats.reduce((sum, s) => sum + s._count, 0);
    const activeSessions =
      sessionStats.find((s) => s.status === SessionStatus.ACTIVE)?._count ?? 0;
    const completedSessions =
      sessionStats.find((s) => s.status === SessionStatus.COMPLETED)?._count ?? 0;

    const correctMap = new Map(correctByTask.map((c) => [c.taskId, c._count]));

    const taskCompletionRates = tasks.map((t) => ({
      taskId: t.id,
      title: t.title,
      completedCount: correctMap.get(t.id) ?? 0,
      totalAttempts: attemptsByTaskMap.get(t.id) ?? 0,
    }));

    const avgCompletionRate =
      taskCompletionRates.length > 0
        ? taskCompletionRates.reduce(
            (sum, r) =>
              sum + (r.totalAttempts > 0 ? r.completedCount / r.totalAttempts : 0),
            0,
          ) / taskCompletionRates.length
        : 0;

    return {
      totalSessions,
      activeSessions,
      completedSessions,
      totalAttempts,
      avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
      taskCompletionRates,
    };
  }

  /**
   * Revert a PUBLISHED game back to DRAFT. Blocked if active sessions exist.
   */
  async unpublish(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameWithCounts> {
    const game = await this.findOne(id);

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    if (game.status !== GameStatus.PUBLISHED) {
      throw new ForbiddenException(
        `Can only unpublish PUBLISHED games, current status: ${game.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Block if there's an active run
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

      return this.mapCounts(updated);
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
    const game = await this.findOne(id);

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

    return this.mapCounts(updated);
  }

  /**
   * Restart a published game: end the current run and start a new one.
   */
  async restartGame(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<GameRun> {
    // End the current run if one exists
    const activeRun = await this.prisma.gameRun.findFirst({
      where: { gameId: id, status: RunStatus.ACTIVE },
    });

    if (activeRun) {
      await this.endRun(id, requesterId, isAdmin);
    }

    return this.startRun(id, requesterId, isAdmin);
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

    return games.map((g) => this.mapCounts(g));
  }

  // ── Analytics ───────────────────────────────────────────────────────────────

  /**
   * Player activity time-series: unique players and task completions per day.
   */
  async getPlayerActivityTimeSeries(gameId: string, days: number, runId?: string) {
    await this.findOne(gameId);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const sessionWhere: Prisma.GameSessionWhereInput = { gameId, startedAt: { gte: since } };
    if (runId) sessionWhere.gameRunId = runId;

    const attemptWhere: Prisma.TaskAttemptWhereInput = {
      task: { gameId },
      status: AttemptStatus.CORRECT,
      createdAt: { gte: since },
    };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const [sessions, attempts] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: sessionWhere,
        select: { userId: true, startedAt: true },
      }),
      this.prisma.taskAttempt.findMany({
        where: attemptWhere,
        select: { createdAt: true },
      }),
    ]);

    // Build a map of date → { players: Set, completions: number }
    const dateMap = new Map<string, { players: Set<string>; completions: number }>();

    // Pre-fill all days so gaps show as 0
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { players: new Set(), completions: 0 });
    }

    for (const s of sessions) {
      const key = new Date(s.startedAt).toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry) entry.players.add(s.userId);
    }

    for (const a of attempts) {
      const key = new Date(a.createdAt).toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry) entry.completions++;
    }

    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { players, completions }]) => ({
        date,
        players: players.size,
        completions,
      }));
  }

  /**
   * Task difficulty: average attempts per task (total attempts / unique sessions).
   */
  async getTaskDifficultyStats(gameId: string, runId?: string) {
    await this.findOne(gameId);

    const tasks = await this.prisma.task.findMany({
      where: { gameId },
      select: { id: true, title: true },
      orderBy: { orderIndex: 'asc' },
    });

    if (tasks.length === 0) return [];

    const attemptWhere: Prisma.TaskAttemptWhereInput = { task: { gameId } };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const attempts = await this.prisma.taskAttempt.findMany({
      where: attemptWhere,
      select: { taskId: true, sessionId: true },
    });

    // Group by taskId
    const taskMap = new Map<string, { total: number; sessions: Set<string> }>();
    for (const a of attempts) {
      let entry = taskMap.get(a.taskId);
      if (!entry) {
        entry = { total: 0, sessions: new Set() };
        taskMap.set(a.taskId, entry);
      }
      entry.total++;
      entry.sessions.add(a.sessionId);
    }

    return tasks.map((t) => {
      const entry = taskMap.get(t.id);
      const avgAttempts =
        entry && entry.sessions.size > 0
          ? parseFloat((entry.total / entry.sessions.size).toFixed(1))
          : 0;
      return {
        taskId: t.id,
        taskTitle: t.title,
        avgAttempts,
        avgTimeSec: 0,
      };
    });
  }

  /**
   * AI verification stats: per-task evaluation count, avg score, error rate.
   */
  async getAiVerificationStats(gameId: string, runId?: string) {
    await this.findOne(gameId);

    const tasks = await this.prisma.task.findMany({
      where: { gameId },
      select: { id: true, title: true },
      orderBy: { orderIndex: 'asc' },
    });

    if (tasks.length === 0) return [];

    const attemptWhere: Prisma.TaskAttemptWhereInput = {
      task: { gameId },
      aiResult: { not: Prisma.JsonNull },
    };
    if (runId) attemptWhere.session = { gameRunId: runId };

    const attempts = await this.prisma.taskAttempt.findMany({
      where: attemptWhere,
      select: { taskId: true, aiResult: true, status: true },
    });

    // Group by taskId
    const taskMap = new Map<
      string,
      { scores: number[]; errorCount: number; total: number }
    >();

    for (const a of attempts) {
      let entry = taskMap.get(a.taskId);
      if (!entry) {
        entry = { scores: [], errorCount: 0, total: 0 };
        taskMap.set(a.taskId, entry);
      }
      entry.total++;
      if (a.status === AttemptStatus.ERROR) entry.errorCount++;

      // Extract score from aiResult JSON
      const result = a.aiResult as Record<string, unknown> | null;
      if (result && typeof result.score === 'number') {
        entry.scores.push(result.score);
      }
    }

    return tasks.map((t) => {
      const entry = taskMap.get(t.id);
      if (!entry || entry.total === 0) {
        return {
          taskName: t.title,
          evaluations: 0,
          avgScore: 0,
          errorRate: 0,
        };
      }

      const avgScore =
        entry.scores.length > 0
          ? parseFloat(
              (
                (entry.scores.reduce((sum, s) => sum + s, 0) /
                  entry.scores.length) *
                100
              ).toFixed(1),
            )
          : 0;

      return {
        taskName: t.title,
        evaluations: entry.total,
        avgScore,
        errorRate: parseFloat(
          ((entry.errorCount / entry.total) * 100).toFixed(1),
        ),
      };
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private mapCounts(
    game: Game & {
      creator: { id: string; displayName: string | null };
      runs?: GameRun[];
      _count: { tasks: number; sessions: number };
    },
  ): GameWithCounts {
    const { _count, runs, ...rest } = game;
    return {
      ...rest,
      taskCount: _count.tasks,
      playerCount: _count.sessions,
      activeRun: runs?.[0] ?? null,
    };
  }
}
