import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;
  let prisma: any;

  const mockTeam = {
    id: 'team-1',
    gameId: 'game-1',
    name: 'Alpha',
    code: 'ABC123',
    captainId: 'user-1',
    maxMembers: 4,
    createdAt: new Date(),
    members: [
      {
        id: 'member-1',
        teamId: 'team-1',
        userId: 'user-1',
        joinedAt: new Date(),
        user: { id: 'user-1', displayName: 'Captain', avatarUrl: null },
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      game: { findUnique: jest.fn() },
      team: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      teamMember: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new TeamService(prisma);
  });

  describe('createTeam', () => {
    it('should throw NotFoundException when game not found', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(
        service.createTeam('game-1', 'user-1', { name: 'Team' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when team mode is off', async () => {
      prisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        settings: { teamMode: false },
      });

      await expect(
        service.createTeam('game-1', 'user-1', { name: 'Team' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when user already in a team', async () => {
      prisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        settings: { teamMode: true },
      });
      prisma.teamMember.findFirst.mockResolvedValue({ teamId: 'other-team' });

      await expect(
        service.createTeam('game-1', 'user-1', { name: 'Team' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('joinTeam', () => {
    it('should throw NotFoundException for invalid code', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.joinTeam('INVALID', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when team is full', async () => {
      prisma.team.findUnique.mockResolvedValue({
        ...mockTeam,
        maxMembers: 1,
      });

      await expect(
        service.joinTeam('ABC123', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when already a member', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.teamMember.findFirst.mockResolvedValue({ teamId: 'team-1' });

      await expect(
        service.joinTeam('ABC123', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('leaveTeam', () => {
    it('should throw NotFoundException when team not found', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.leaveTeam('missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prisma.team.findUnique.mockResolvedValue({
        ...mockTeam,
        members: [],
      });

      await expect(
        service.leaveTeam('team-1', 'user-99'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should disband team when last member leaves', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.team.delete.mockResolvedValue({});

      const result = await service.leaveTeam('team-1', 'user-1');

      expect(result.message).toContain('disbanded');
      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    });
  });

  describe('generateCode', () => {
    it('should generate a 6-character code', () => {
      const code = service.generateCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should generate unique codes', () => {
      const codes = new Set(Array.from({ length: 50 }, () => service.generateCode()));
      // With 36^6 possibilities, 50 codes should all be unique
      expect(codes.size).toBe(50);
    });
  });
});
