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

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.role === UserRole.ADMIN && role === UserRole.PLAYER) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last admin. Promote another user first.',
        );
      }
    }

    const updated = await this.prisma.user.update({
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

    return updated;
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
      version: process.env.npm_package_version ?? '1.0.0',
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
    const [recentGames, recentSessions] = await Promise.all([
      this.prisma.game.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, createdAt: true },
      }),
      this.prisma.gameSession.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          startedAt: true,
          user: { select: { displayName: true } },
          game: { select: { title: true } },
        },
      }),
    ]);

    const activity: Array<{
      id: string;
      type: 'game_created' | 'game_published' | 'session_completed' | 'player_joined';
      label: string;
      detail: string;
      timestamp: string;
    }> = [];

    for (const game of recentGames) {
      activity.push({
        id: `game-${game.id}`,
        type: game.status === 'PUBLISHED' ? 'game_published' : 'game_created',
        label: game.title,
        detail: game.status === 'PUBLISHED' ? 'Gra opublikowana' : 'Nowa gra utworzona',
        timestamp: game.createdAt.toISOString(),
      });
    }

    for (const session of recentSessions) {
      activity.push({
        id: `session-${session.id}`,
        type: session.status === 'COMPLETED' ? 'session_completed' : 'player_joined',
        label: session.user.displayName,
        detail: session.game.title,
        timestamp: session.startedAt.toISOString(),
      });
    }

    // Sort by timestamp descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activity.slice(0, 10);
  }
}
