import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { RankingGateway } from '../ranking/ranking.gateway';
import { RankingService } from '../ranking/ranking.service';

@Injectable()
export class ActivityBroadcastService {
  private readonly logger = new Logger(ActivityBroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingService: RankingService,
    private readonly rankingGateway: RankingGateway,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Orchestrates post-correct-answer side effects: ranking updates, WebSocket
   * broadcasts, and push notifications. Handles both solo and team modes.
   */
  async handlePostCorrect(
    gameId: string,
    runId: string,
    userId: string,
    taskId: string,
    taskTitle: string,
    pointsAwarded: number,
    totalPoints: number,
    teamId: string | null,
    attemptId: string,
  ): Promise<void> {
    if (teamId) {
      await this.rankingService.updateTeamScore(runId, teamId, totalPoints);
      const teamRanking = await this.rankingService.getTeamRanking(runId);

      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { name: true },
      });

      this.rankingGateway.broadcastTeamUpdate(gameId, {
        gameId,
        teamId,
        teamName: team?.name ?? teamId,
        ranking: teamRanking,
      });

      this.rankingGateway.broadcastPlayerCompletedTask({
        gameId,
        userId,
        taskId,
        pointsAwarded,
        totalPoints,
      });
    } else {
      await this.rankingService.updateScore(runId, userId, totalPoints);
      const ranking = await this.rankingService.getRanking(runId);
      this.rankingGateway.broadcastRankingUpdate(gameId, ranking);
      this.rankingGateway.broadcastPlayerCompletedTask({
        gameId,
        userId,
        taskId,
        pointsAwarded,
        totalPoints,
      });

      await this.notifyTopRankingChanges(gameId, ranking);
    }

    await this.onTaskCorrect(gameId, userId, taskId, taskTitle, pointsAwarded, attemptId, teamId);
  }

  /**
   * Broadcast a "player joined" activity event to admin monitoring.
   */
  async broadcastJoinActivity(gameId: string, userId: string): Promise<void> {
    const player = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    this.rankingGateway.broadcastActivity(gameId, {
      type: 'game_joined',
      playerName: player?.displayName ?? 'Player',
      details: 'joined the game',
    });
  }

  /**
   * Broadcast a "hint used" activity event to admin monitoring.
   */
  async broadcastHintActivity(
    gameId: string,
    userId: string,
    taskTitle: string,
  ): Promise<void> {
    const player = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    this.rankingGateway.broadcastActivity(gameId, {
      type: 'hint_used',
      playerName: player?.displayName ?? 'Player',
      details: `used hint on task "${taskTitle}"`,
    });
  }

  /**
   * After a correct answer: broadcast activity and push notifications.
   */
  private async onTaskCorrect(
    gameId: string,
    userId: string,
    taskId: string,
    taskTitle: string,
    pointsAwarded: number,
    attemptId: string,
    teamId: string | null,
  ): Promise<void> {
    const player = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    const playerName = player?.displayName ?? 'Player';

    this.rankingGateway.broadcastActivity(gameId, {
      type: 'task_completed',
      playerName,
      details: `completed task "${taskTitle}"`,
      points: pointsAwarded,
      taskId,
    });

    // Push notifications to other active players
    const otherSessionsWhere: Prisma.GameSessionWhereInput = {
      gameId,
      status: SessionStatus.ACTIVE,
      userId: { not: userId },
      ...(teamId ? {} : { teamId: null }),
    };

    const otherSessions = await this.prisma.gameSession.findMany({
      where: otherSessionsWhere,
      select: { userId: true },
    });

    if (otherSessions.length > 0) {
      const otherUserIds = otherSessions.map((s) => s.userId);
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: otherUserIds },
          pushToken: { not: null },
        },
        select: { pushToken: true },
      });

      const tokens = users.map((u) => u.pushToken).filter((t): t is string => t !== null);

      if (tokens.length > 0) {
        await this.notificationService.sendToMultiple(
          tokens,
          'New achievement',
          `${playerName} completed task "${taskTitle}"! (+${pointsAwarded} pts)`,
          { gameId, type: 'task_completed', attemptId },
        );
      }
    }

    if (teamId) {
      await this.notifyTeamMembers(gameId, teamId, userId, playerName, taskTitle, pointsAwarded, attemptId);
    }
  }

  /**
   * Push notification to team members about a teammate's completion.
   */
  private async notifyTeamMembers(
    gameId: string,
    teamId: string,
    solverId: string,
    solverName: string,
    taskTitle: string,
    pointsAwarded: number,
    attemptId: string,
  ): Promise<void> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId, userId: { not: solverId } },
      include: {
        user: { select: { pushToken: true } },
      },
    });

    const tokens = members
      .map((m) => m.user.pushToken)
      .filter((t): t is string => t !== null);

    if (tokens.length > 0) {
      await this.notificationService.sendToMultiple(
        tokens,
        'Your team scored points!',
        `${solverName} completed task "${taskTitle}"! (+${pointsAwarded} pts)`,
        { gameId, teamId, type: 'team_task_completed', attemptId },
      );
    }
  }

  /**
   * Notify players in the top 3 whose position may have changed.
   */
  private async notifyTopRankingChanges(
    gameId: string,
    ranking: { userId: string; score: number; rank: number }[],
  ): Promise<void> {
    const top3 = ranking.slice(0, 3);
    if (top3.length === 0) return;

    const top3UserIds = top3.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: top3UserIds },
        pushToken: { not: null },
      },
      select: { id: true, pushToken: true, displayName: true },
    });

    for (const user of users) {
      if (!user.pushToken) continue;
      const entry = top3.find((r) => r.userId === user.id);
      if (!entry) continue;

      await this.notificationService.sendPushNotification(
        user.pushToken,
        'Ranking updated',
        `You are #${entry.rank} with ${entry.score} pts!`,
        { gameId, type: 'ranking_update', rank: entry.rank },
      );
    }
  }
}
