import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SessionStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUserRole(userId: string, role: UserRole, requestingAdminId: string) {
    if (userId === requestingAdminId) {
      throw new BadRequestException('Cannot change your own role');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      if (user.role === UserRole.ADMIN && role === UserRole.PLAYER) {
        const adminCount = await tx.user.count({
          where: { role: UserRole.ADMIN },
        });
        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot demote the last admin. Promote another user first.',
          );
        }
      }

      return tx.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async getSystemInfo() {
    const [userCount, gameCount, sessionCount, activeSessionCount] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.game.count(),
        this.prisma.gameSession.count(),
        this.prisma.gameSession.count({
          where: { status: SessionStatus.ACTIVE },
        }),
      ]);

    let dbHealthy = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbHealthy = false;
    }

    return {
      userCount,
      gameCount,
      sessionCount,
      activeSessionCount,
      dbHealthy,
      version: process.env.APP_VERSION ?? process.env.npm_package_version ?? '1.0.0',
    };
  }

  async getDashboardStats() {
    const [
      activeGames,
      totalPlayers,
      totalTasks,
      activeSessions,
    ] = await this.prisma.$transaction([
      this.prisma.game.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.user.count({ where: { role: 'PLAYER' } }),
      this.prisma.task.count(),
      this.prisma.gameSession.count({ where: { status: SessionStatus.ACTIVE } }),
    ]);

    return { activeGames, totalPlayers, totalTasks, activeSessions };
  }

  async getRecentActivity() {
    const [recentGames, recentSessions] = await this.prisma.$transaction([
      this.prisma.game.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.gameSession.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          user: { select: { displayName: true } },
          game: { select: { title: true } },
        },
      }),
    ]);

    const activity: Array<{
      id: string;
      type: 'game_created' | 'game_published' | 'game_archived' | 'session_completed' | 'session_abandoned' | 'session_timed_out' | 'player_joined';
      label: string;
      detail: string;
      timestamp: string;
    }> = [];

    for (const game of recentGames) {
      activity.push({
        id: `game-${game.id}`,
        type: game.status === 'PUBLISHED' ? 'game_published' : game.status === 'ARCHIVED' ? 'game_archived' : 'game_created',
        label: game.title,
        detail: game.status === 'PUBLISHED' ? 'Game published' : game.status === 'ARCHIVED' ? 'Game archived' : 'New game created',
        timestamp: (game.status === 'DRAFT' ? game.createdAt : game.updatedAt).toISOString(),
      });
    }

    for (const session of recentSessions) {
      const sessionType =
        session.status === 'COMPLETED' ? 'session_completed' as const
        : session.status === 'ABANDONED' ? 'session_abandoned' as const
        : session.status === 'TIMED_OUT' ? 'session_timed_out' as const
        : 'player_joined' as const;

      // For terminal states use completedAt if available, otherwise startedAt
      const ts = sessionType === 'player_joined'
        ? session.startedAt
        : (session.completedAt ?? session.startedAt);

      activity.push({
        id: `session-${session.id}`,
        type: sessionType,
        label: session.user.displayName,
        detail: session.game.title,
        timestamp: ts.toISOString(),
      });
    }

    // Sort by timestamp descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activity.slice(0, 10);
  }
}
