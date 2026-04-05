import { Test, TestingModule } from '@nestjs/testing';
import { GameExpiryService } from './game-expiry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: Record<string, any> = {
  gameRun: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  gameSession: {
    updateMany: jest.fn(),
  },
};

const mockNotification = {
  sendToMultiple: jest.fn(),
};

describe('GameExpiryService', () => {
  let service: GameExpiryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameExpiryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get(GameExpiryService);
  });

  describe('handleExpiredRuns', () => {
    it('does nothing when no expired runs found', async () => {
      mockPrisma.gameRun.findMany.mockResolvedValue([]);

      await service.handleExpiredRuns();

      expect(mockPrisma.gameSession.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.gameRun.update).not.toHaveBeenCalled();
    });

    it('expires runs and notifies players', async () => {
      const expiredRun = {
        id: 'run-1',
        runNumber: 1,
        game: { id: 'game-1', title: 'Test Game' },
        sessions: [
          { id: 's1', userId: 'u1', user: { pushToken: 'ExponentPushToken[abc]' } },
          { id: 's2', userId: 'u2', user: { pushToken: null } },
        ],
      };

      mockPrisma.gameRun.findMany.mockResolvedValue([expiredRun]);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.gameRun.update.mockResolvedValue({});
      mockPrisma.gameRun.updateMany.mockResolvedValue({ count: 0 });

      await service.handleExpiredRuns();

      expect(mockPrisma.gameSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['s1', 's2'] } },
        }),
      );
      expect(mockPrisma.gameRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1' },
        }),
      );
      expect(mockNotification.sendToMultiple).toHaveBeenCalledWith(
        ['ExponentPushToken[abc]'],
        expect.any(String),
        expect.stringContaining('Test Game'),
        expect.objectContaining({ type: 'game_expired' }),
      );
    });
  });
});
