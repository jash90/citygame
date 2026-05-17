import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttemptStatus, Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withSerializableRetry } from '../../common/utils/prisma-retry';
import { RankingGateway } from '../ranking/ranking.gateway';

interface ReviewParams {
  mentorId: string;
  attemptId: string;
  score: number;
  feedback: string;
}

@Injectable()
export class MentorService {
  private readonly logger = new Logger(MentorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingGateway: RankingGateway,
  ) {}

  /**
   * List games the mentor is assigned to, with the count of pending attempts
   * awaiting their review.
   */
  async findMyGames(mentorId: string) {
    const assignments = await this.prisma.gameMentor.findMany({
      where: { mentorId },
      include: {
        game: {
          select: {
            id: true,
            title: true,
            city: true,
            status: true,
            coverImageUrl: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    if (assignments.length === 0) return [];

    const gameIds = assignments.map((a) => a.gameId);

    // Pending attempts per game (single grouped query)
    const pendingByGame = await this.prisma.taskAttempt.groupBy({
      by: ['taskId'],
      where: {
        status: AttemptStatus.PENDING,
        task: { gameId: { in: gameIds } },
      },
      _count: true,
    });

    // Map taskId → gameId so we can sum per game
    const tasks = await this.prisma.task.findMany({
      where: { gameId: { in: gameIds } },
      select: { id: true, gameId: true },
    });
    const taskToGame = new Map(tasks.map((t) => [t.id, t.gameId]));

    const pendingCountByGame = new Map<string, number>();
    for (const row of pendingByGame) {
      const gameId = taskToGame.get(row.taskId);
      if (!gameId) continue;
      pendingCountByGame.set(
        gameId,
        (pendingCountByGame.get(gameId) ?? 0) + row._count,
      );
    }

    return assignments.map((a) => ({
      ...a.game,
      assignedAt: a.assignedAt,
      pendingCount: pendingCountByGame.get(a.gameId) ?? 0,
    }));
  }

  /**
   * List PENDING attempts for a game the mentor is assigned to.
   * Returns submission payload, player info and task config so the mentor can
   * preview media + read the rubric in one query.
   */
  async findPendingAttempts(mentorId: string, gameId: string) {
    await this.requireAssignment(mentorId, gameId);

    return this.prisma.taskAttempt.findMany({
      where: {
        status: AttemptStatus.PENDING,
        task: { gameId },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            maxPoints: true,
            verifyConfig: true,
            orderIndex: true,
          },
        },
        session: {
          select: { id: true, gameRunId: true, gameId: true, teamId: true },
        },
      },
    });
  }

  /**
   * Apply a mentor's verdict to a PENDING attempt:
   *  - score 0   → INCORRECT (0 pkt, player może wysłać ponownie)
   *  - score 100 → CORRECT (full pkt, sesja przechodzi do następnego zadania)
   *  - 1..99     → PARTIAL (proporcjonalnie pkt, sesja NIE awansuje)
   */
  async reviewAttempt(params: ReviewParams) {
    const { mentorId, attemptId, score, feedback } = params;

    if (score < 0 || score > 100 || !Number.isInteger(score)) {
      throw new BadRequestException('Score must be an integer in 0-100');
    }

    const attempt = await this.prisma.taskAttempt.findUnique({
      where: { id: attemptId },
      include: {
        task: true,
        session: { select: { id: true, gameId: true, gameRunId: true, teamId: true } },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Attempt ${attemptId} not found`);
    }

    if (attempt.status !== AttemptStatus.PENDING) {
      throw new BadRequestException(
        `Attempt is already ${attempt.status} — only PENDING attempts can be reviewed`,
      );
    }

    await this.requireAssignment(mentorId, attempt.session.gameId);

    const newStatus =
      score === 0
        ? AttemptStatus.INCORRECT
        : score === 100
          ? AttemptStatus.CORRECT
          : AttemptStatus.PARTIAL;
    const pointsAwarded = Math.round((score / 100) * attempt.task.maxPoints);

    const updated = await withSerializableRetry(this.prisma, async (tx) => {
      const updatedAttempt = await tx.taskAttempt.update({
        where: { id: attemptId },
        data: {
          status: newStatus,
          pointsAwarded,
          reviewedById: mentorId,
          reviewedAt: new Date(),
          reviewerFeedback: feedback,
        },
      });

      if (newStatus === AttemptStatus.CORRECT || newStatus === AttemptStatus.PARTIAL) {
        const sessionRow = await tx.gameSession.update({
          where: { id: attempt.session.id },
          data: { totalPoints: { increment: pointsAwarded } },
          select: { id: true, totalPoints: true, teamId: true },
        });

        if (newStatus === AttemptStatus.CORRECT) {
          const nextTask = await tx.task.findFirst({
            where: {
              gameId: attempt.session.gameId,
              orderIndex: { gt: attempt.task.orderIndex },
            },
            orderBy: { orderIndex: 'asc' },
          });

          if (sessionRow.teamId) {
            await tx.gameSession.updateMany({
              where: {
                gameId: attempt.session.gameId,
                teamId: sessionRow.teamId,
                status: SessionStatus.ACTIVE,
              },
              data: {
                currentTaskId: nextTask?.id ?? null,
                status: nextTask ? SessionStatus.ACTIVE : SessionStatus.COMPLETED,
                completedAt: nextTask ? undefined : new Date(),
                totalPoints: sessionRow.totalPoints,
              },
            });
          } else {
            await tx.gameSession.update({
              where: { id: attempt.session.id },
              data: {
                currentTaskId: nextTask?.id ?? null,
                status: nextTask ? SessionStatus.ACTIVE : SessionStatus.COMPLETED,
                completedAt: nextTask ? undefined : new Date(),
              },
            });
          }
        }
      }

      return updatedAttempt;
    });

    // Broadcast result so the player's mobile app refreshes the attempt state.
    this.rankingGateway.broadcastMentorReviewResult(attempt.session.gameId, {
      attemptId: updated.id,
      userId: attempt.userId,
      taskId: attempt.taskId,
      status: newStatus,
      pointsAwarded,
      feedback,
    });

    return updated;
  }

  // ─── Admin-side helpers (Game ↔ Mentor assignments) ─────────────────────────

  async assignMentor(gameId: string, mentorId: string) {
    const mentor = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: { id: true, role: true },
    });
    if (!mentor) throw new NotFoundException(`User ${mentorId} not found`);
    if (mentor.role !== 'MENTOR') {
      throw new BadRequestException(
        `User ${mentorId} must have role MENTOR (current: ${mentor.role})`,
      );
    }

    try {
      return await this.prisma.gameMentor.create({
        data: { gameId, mentorId },
        include: {
          mentor: { select: { id: true, displayName: true, email: true } },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Mentor is already assigned to this game');
      }
      throw err;
    }
  }

  async unassignMentor(gameId: string, mentorId: string) {
    const existing = await this.prisma.gameMentor.findUnique({
      where: { gameId_mentorId: { gameId, mentorId } },
    });
    if (!existing) throw new NotFoundException('Mentor not assigned to this game');
    await this.prisma.gameMentor.delete({
      where: { gameId_mentorId: { gameId, mentorId } },
    });
    return { unassigned: true };
  }

  async listGameMentors(gameId: string) {
    return this.prisma.gameMentor.findMany({
      where: { gameId },
      include: {
        mentor: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Throws ForbiddenException if `mentorId` is not assigned to `gameId`.
   * Run at request time so demotion / unassignment takes effect immediately.
   */
  private async requireAssignment(mentorId: string, gameId: string) {
    const assignment = await this.prisma.gameMentor.findUnique({
      where: { gameId_mentorId: { gameId, mentorId } },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this game');
    }
  }
}
