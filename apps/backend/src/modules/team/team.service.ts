import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Team, TeamMember } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { GameSettings } from '../../common/types/game-settings';
import { CreateTeamDto } from './dto/create-team.dto';

export interface TeamWithMembers extends Team {
  members: (TeamMember & {
    user: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  })[];
}

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new team for a game. The creator becomes captain and first member.
   * The game must have teamMode enabled in its settings.
   */
  async createTeam(
    gameId: string,
    userId: string,
    dto: CreateTeamDto,
  ): Promise<TeamWithMembers> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, settings: true },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    const settings = game.settings as GameSettings;
    if (!settings.teamMode) {
      throw new BadRequestException('This game does not have team mode enabled');
    }

    const existingMembership = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        team: { gameId },
      },
    });

    if (existingMembership) {
      throw new ConflictException('You are already in a team for this game');
    }

    const maxMembers = dto.maxMembers ?? (settings.maxTeamSize ?? 4);
    const code = this.generateCode();

    const team = await this.prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          gameId,
          name: dto.name,
          code,
          captainId: userId,
          maxMembers,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId,
        },
      });

      return tx.team.findUniqueOrThrow({
        where: { id: newTeam.id },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
            },
          },
        },
      });
    });

    return team;
  }

  /**
   * Join an existing team using its join code.
   * Validates that the team is not full and the user is not already in another team.
   */
  async joinTeam(code: string, userId: string): Promise<TeamWithMembers> {
    const team = await this.prisma.team.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found — check the join code');
    }

    if (team.members.length >= team.maxMembers) {
      throw new BadRequestException(`Team is full (max ${team.maxMembers} members)`);
    }

    const existingMembership = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        team: { gameId: team.gameId },
      },
    });

    if (existingMembership) {
      if (existingMembership.teamId === team.id) {
        throw new ConflictException('You are already a member of this team');
      }
      throw new ConflictException('You are already in another team for this game');
    }

    await this.prisma.teamMember.create({
      data: { teamId: team.id, userId },
    });

    return this.prisma.team.findUniqueOrThrow({
      where: { id: team.id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  /**
   * Leave a team. If the captain leaves, the next member becomes captain.
   * If the last member leaves, the team is deleted.
   */
  async leaveTeam(teamId: string, userId: string): Promise<{ message: string }> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    const membership = team.members.find((m) => m.userId === userId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    if (team.members.length === 1) {
      // Last member — delete the entire team
      await this.prisma.team.delete({ where: { id: teamId } });
      return { message: 'Team disbanded — you were the last member' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({ where: { id: membership.id } });

      if (team.captainId === userId) {
        const nextMember = team.members.find((m) => m.userId !== userId);
        if (nextMember) {
          await tx.team.update({
            where: { id: teamId },
            data: { captainId: nextMember.userId },
          });
        }
      }
    });

    return { message: 'You have left the team' };
  }

  /**
   * Get a team with all its members.
   */
  async getTeam(teamId: string): Promise<TeamWithMembers> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    return team;
  }

  /**
   * Get all teams registered for a game.
   */
  async getTeamsByGame(gameId: string): Promise<TeamWithMembers[]> {
    return this.prisma.team.findMany({
      where: { gameId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get the team that the given user belongs to in a specific game.
   */
  async getMyTeam(gameId: string, userId: string): Promise<TeamWithMembers> {
    const membership = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        team: { gameId },
      },
      select: { teamId: true },
    });

    if (!membership) {
      throw new NotFoundException('You are not in any team for this game');
    }

    return this.getTeam(membership.teamId);
  }

  /**
   * Find the team a user belongs to in a game, returning null if not in one.
   * Used internally by PlayerService.
   */
  async findMembership(
    gameId: string,
    userId: string,
  ): Promise<{ teamId: string } | null> {
    return this.prisma.teamMember.findFirst({
      where: {
        userId,
        team: { gameId },
      },
      select: { teamId: true },
    });
  }

  /**
   * Generate a cryptographically secure 6-character alphanumeric uppercase join code.
   */
  generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(6);
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join('');
  }
}
