import { Test, TestingModule } from '@nestjs/testing';
import { ActivityBroadcastService } from './activity-broadcast.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { TeamRankingService } from '../ranking/team-ranking.service';
import { RankingGateway } from '../ranking/ranking.gateway';
import { NotificationService } from '../notification/notification.service';

 
const mockPrisma: Record<string, any> = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  team: { findUnique: jest.fn() },
  gameSession: { findMany: jest.fn() },
  teamMember: { findMany: jest.fn() },
};

const mockRanking = {
  updateScore: jest.fn(),
  getRanking: jest.fn().mockResolvedValue([]),
};

const mockTeamRanking = {
  updateTeamScore: jest.fn(),
  getTeamRanking: jest.fn().mockResolvedValue([]),
};

const mockGateway = {
  broadcastRankingUpdate: jest.fn(),
  broadcastPlayerCompletedTask: jest.fn(),
  broadcastActivity: jest.fn(),
  broadcastTeamUpdate: jest.fn(),
};

const mockNotification = {
  sendPushNotification: jest.fn(),
  sendToMultiple: jest.fn(),
};

describe('ActivityBroadcastService', () => {
  let service: ActivityBroadcastService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityBroadcastService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RankingService, useValue: mockRanking },
        { provide: TeamRankingService, useValue: mockTeamRanking },
        { provide: RankingGateway, useValue: mockGateway },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get(ActivityBroadcastService);
  });

  describe('broadcastJoinActivity', () => {
    it('broadcasts join event with player name', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Alice' });

      await service.broadcastJoinActivity('game-1', 'user-1');

      expect(mockGateway.broadcastActivity).toHaveBeenCalledWith('game-1', {
        type: 'game_joined',
        playerName: 'Alice',
        details: 'joined the game',
      });
    });

    it('uses "Player" fallback when no displayName', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: null });

      await service.broadcastJoinActivity('game-1', 'user-1');

      expect(mockGateway.broadcastActivity).toHaveBeenCalledWith('game-1',
        expect.objectContaining({ playerName: 'Player' }),
      );
    });
  });

  describe('broadcastHintActivity', () => {
    it('broadcasts hint used event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Bob' });

      await service.broadcastHintActivity('game-1', 'user-1', 'Find the monument');

      expect(mockGateway.broadcastActivity).toHaveBeenCalledWith('game-1', {
        type: 'hint_used',
        playerName: 'Bob',
        details: 'used hint on task "Find the monument"',
      });
    });
  });

  describe('handlePostCorrect', () => {
    it('updates ranking and broadcasts for solo mode', async () => {
      mockRanking.updateScore.mockResolvedValue(undefined);
      mockRanking.getRanking.mockResolvedValue([
        { userId: 'user-1', score: 150, rank: 1 },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Alice' });
      mockPrisma.gameSession.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.handlePostCorrect(
        'game-1', 'run-1', 'user-1', 'task-1', 'Task Title',
        50, 150, null, 'attempt-1',
      );

      expect(mockRanking.updateScore).toHaveBeenCalledWith('run-1', 'user-1', 150);
      expect(mockGateway.broadcastRankingUpdate).toHaveBeenCalledWith('game-1', expect.any(Array));
      expect(mockGateway.broadcastPlayerCompletedTask).toHaveBeenCalled();
      expect(mockGateway.broadcastActivity).toHaveBeenCalledWith('game-1',
        expect.objectContaining({ type: 'task_completed' }),
      );
    });

    it('updates team ranking for team mode', async () => {
      mockTeamRanking.updateTeamScore.mockResolvedValue(undefined);
      mockTeamRanking.getTeamRanking.mockResolvedValue([]);
      mockPrisma.team.findUnique.mockResolvedValue({ name: 'Team Alpha' });
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Alice' });
      mockPrisma.gameSession.findMany.mockResolvedValue([]);
      mockPrisma.teamMember.findMany.mockResolvedValue([]);

      await service.handlePostCorrect(
        'game-1', 'run-1', 'user-1', 'task-1', 'Task Title',
        50, 150, 'team-1', 'attempt-1',
      );

      expect(mockTeamRanking.updateTeamScore).toHaveBeenCalledWith('run-1', 'team-1', 150);
      expect(mockGateway.broadcastTeamUpdate).toHaveBeenCalled();
    });

    it('sends push notifications to other players', async () => {
      mockRanking.updateScore.mockResolvedValue(undefined);
      mockRanking.getRanking.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ displayName: 'Alice' });
      mockPrisma.gameSession.findMany.mockResolvedValue([
        { userId: 'user-2' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { pushToken: 'ExponentPushToken[xxx]' },
      ]);

      await service.handlePostCorrect(
        'game-1', 'run-1', 'user-1', 'task-1', 'Task Title',
        50, 150, null, 'attempt-1',
      );

      expect(mockNotification.sendToMultiple).toHaveBeenCalledWith(
        ['ExponentPushToken[xxx]'],
        'New achievement',
        expect.stringContaining('Alice'),
        expect.objectContaining({ type: 'task_completed' }),
      );
    });
  });
});
