import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttemptStatus, SessionStatus, UserRole } from '@prisma/client';
import { MentorService } from './mentor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RankingGateway } from '../ranking/ranking.gateway';


const mockPrisma: Record<string, any> = {
  gameMentor: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  taskAttempt: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  gameSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((fn: unknown) => {
    if (typeof fn === 'function') {
      return (fn as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(fn as Promise<unknown>[]);
  }),
};

const mockGateway = {
  broadcastMentorReviewResult: jest.fn(),
};

describe('MentorService', () => {
  let service: MentorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RankingGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(MentorService);
  });

  describe('findMyGames', () => {
    it('returns assigned games with pending counts', async () => {
      mockPrisma.gameMentor.findMany.mockResolvedValue([
        {
          gameId: 'g1',
          assignedAt: new Date(),
          game: { id: 'g1', title: 'Game 1', city: 'X', status: 'PUBLISHED', coverImageUrl: null },
        },
      ]);
      mockPrisma.taskAttempt.groupBy.mockResolvedValue([
        { taskId: 't1', _count: 2 },
        { taskId: 't2', _count: 1 },
      ]);
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't1', gameId: 'g1' },
        { id: 't2', gameId: 'g1' },
      ]);

      const result = await service.findMyGames('mentor-1');
      expect(result).toHaveLength(1);
      expect(result[0].pendingCount).toBe(3);
    });

    it('returns empty array when no assignments', async () => {
      mockPrisma.gameMentor.findMany.mockResolvedValue([]);
      const result = await service.findMyGames('mentor-1');
      expect(result).toEqual([]);
    });
  });

  describe('reviewAttempt', () => {
    function makeAttempt(overrides: Record<string, unknown> = {}) {
      return {
        id: 'a1',
        userId: 'u1',
        taskId: 't1',
        status: AttemptStatus.PENDING,
        session: {
          id: 's1',
          gameId: 'g1',
          gameRunId: 'r1',
          teamId: null,
          status: SessionStatus.ACTIVE,
        },
        task: { id: 't1', maxPoints: 100, orderIndex: 0 },
        ...overrides,
      };
    }

    function primeHappyPath() {
      // Session is ACTIVE inside tx, attempt successfully claimed.
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        status: SessionStatus.ACTIVE,
      });
      mockPrisma.taskAttempt.updateMany.mockResolvedValue({ count: 1 });
    }

    it('maps score=100 to CORRECT, awards full points and advances session', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(makeAttempt());
      mockPrisma.gameMentor.findUnique.mockResolvedValue({ id: 'gm1' });
      primeHappyPath();
      mockPrisma.taskAttempt.findUniqueOrThrow.mockResolvedValue({
        id: 'a1', status: AttemptStatus.CORRECT, pointsAwarded: 100,
      });
      mockPrisma.gameSession.update.mockResolvedValue({ id: 's1', totalPoints: 100, teamId: null });
      mockPrisma.task.findFirst.mockResolvedValue(null); // no next task — session COMPLETED

      const result = await service.reviewAttempt({
        mentorId: 'mentor-1',
        attemptId: 'a1',
        score: 100,
        feedback: 'Świetnie',
      });

      expect(result.status).toBe(AttemptStatus.CORRECT);
      expect(mockPrisma.taskAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1', status: AttemptStatus.PENDING },
          data: expect.objectContaining({
            status: AttemptStatus.CORRECT,
            pointsAwarded: 100,
            reviewedById: 'mentor-1',
            reviewerFeedback: 'Świetnie',
          }),
        }),
      );
      expect(mockGateway.broadcastMentorReviewResult).toHaveBeenCalled();
    });

    it('maps score=50 to PARTIAL, awards half points, AND advances session', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(makeAttempt());
      mockPrisma.gameMentor.findUnique.mockResolvedValue({ id: 'gm1' });
      primeHappyPath();
      mockPrisma.taskAttempt.findUniqueOrThrow.mockResolvedValue({
        id: 'a1', status: AttemptStatus.PARTIAL, pointsAwarded: 50,
      });
      mockPrisma.gameSession.update.mockResolvedValue({ id: 's1', totalPoints: 50, teamId: null });
      mockPrisma.task.findFirst.mockResolvedValue({ id: 'task-next', orderIndex: 1 });

      await service.reviewAttempt({
        mentorId: 'mentor-1',
        attemptId: 'a1',
        score: 50,
        feedback: 'OK ale brakuje detalu',
      });

      // PARTIAL locks the task — one shot at partial credit (no infinite
      // resubmits against the non-deterministic AI). task.findFirst is called
      // to pick the next task in line.
      expect(mockPrisma.task.findFirst).toHaveBeenCalled();
    });

    it('maps score=0 to INCORRECT, awards 0 points, but still records reviewer audit fields', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(makeAttempt());
      mockPrisma.gameMentor.findUnique.mockResolvedValue({ id: 'gm1' });
      primeHappyPath();
      mockPrisma.taskAttempt.findUniqueOrThrow.mockResolvedValue({
        id: 'a1', status: AttemptStatus.INCORRECT, pointsAwarded: 0,
      });

      await service.reviewAttempt({
        mentorId: 'mentor-1',
        attemptId: 'a1',
        score: 0,
        feedback: 'Nie spełnia kryteriów',
      });

      // No session update for INCORRECT
      expect(mockPrisma.gameSession.update).not.toHaveBeenCalled();

      // Reviewer audit fields MUST still be set so player sees mentor feedback
      // and the attempt is recoverable. Earlier worktree had a bug where these
      // were only set on CORRECT/PARTIAL.
      expect(mockPrisma.taskAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AttemptStatus.INCORRECT,
            pointsAwarded: 0,
            reviewedById: 'mentor-1',
            reviewerFeedback: 'Nie spełnia kryteriów',
          }),
        }),
      );
    });

    it('throws ForbiddenException when mentor is not assigned to game', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(makeAttempt());
      mockPrisma.gameMentor.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewAttempt({
          mentorId: 'mentor-1',
          attemptId: 'a1',
          score: 80,
          feedback: 'ok',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when session is not ACTIVE', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(
        makeAttempt({
          session: {
            id: 's1',
            gameId: 'g1',
            gameRunId: 'r1',
            teamId: null,
            status: SessionStatus.COMPLETED,
          },
        }),
      );

      await expect(
        service.reviewAttempt({
          mentorId: 'mentor-1',
          attemptId: 'a1',
          score: 80,
          feedback: 'ok',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when another mentor finalised the attempt concurrently', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(makeAttempt());
      mockPrisma.gameMentor.findUnique.mockResolvedValue({ id: 'gm1' });
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        status: SessionStatus.ACTIVE,
      });
      // Conditional update found 0 rows — race lost.
      mockPrisma.taskAttempt.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reviewAttempt({
          mentorId: 'mentor-1',
          attemptId: 'a1',
          score: 80,
          feedback: 'ok',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when attempt is not PENDING', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(
        makeAttempt({ status: AttemptStatus.CORRECT }),
      );

      await expect(
        service.reviewAttempt({
          mentorId: 'mentor-1',
          attemptId: 'a1',
          score: 50,
          feedback: 'x',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when attempt does not exist', async () => {
      mockPrisma.taskAttempt.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewAttempt({
          mentorId: 'mentor-1',
          attemptId: 'missing',
          score: 50,
          feedback: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects score outside 0-100', async () => {
      await expect(
        service.reviewAttempt({
          mentorId: 'mentor-1',
          attemptId: 'a1',
          score: 150,
          feedback: 'x',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignMentor', () => {
    it('refuses to assign a non-MENTOR user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: UserRole.PLAYER });
      await expect(service.assignMentor('g1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('assigns when user is a MENTOR', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: UserRole.MENTOR });
      mockPrisma.gameMentor.create.mockResolvedValue({ id: 'gm1' });
      const result = await service.assignMentor('g1', 'u1');
      expect(result.id).toBe('gm1');
    });
  });
});

// Avoid "unused" lint hit for the SessionStatus import (only kept for parity with service file)
void SessionStatus;
