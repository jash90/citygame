import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService, EXPO_CLIENT } from './notification.service';

const mockSendPushNotificationsAsync = jest.fn().mockResolvedValue([]);
const mockChunkPushNotifications = jest.fn((messages: unknown[]) => [messages]);

const mockExpo = {
  sendPushNotificationsAsync: mockSendPushNotificationsAsync,
  chunkPushNotifications: mockChunkPushNotifications,
};

// Mock static method
jest.mock('expo-server-sdk', () => {
  const ActualExpo = jest.requireActual('expo-server-sdk').Expo;
  return {
    Expo: Object.assign(
      jest.fn(() => mockExpo),
      { isExpoPushToken: ActualExpo.isExpoPushToken },
    ),
  };
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: EXPO_CLIENT, useValue: mockExpo },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('sendPushNotification', () => {
    it('sends a notification for a valid token', async () => {
      await service.sendPushNotification(
        'ExponentPushToken[abc123]',
        'Test Title',
        'Test Body',
      );

      expect(mockSendPushNotificationsAsync).toHaveBeenCalledWith([
        expect.objectContaining({
          to: 'ExponentPushToken[abc123]',
          title: 'Test Title',
          body: 'Test Body',
        }),
      ]);
    });

    it('skips invalid tokens', async () => {
      await service.sendPushNotification('invalid-token', 'Title', 'Body');
      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });
  });

  describe('sendToMultiple', () => {
    it('sends to multiple valid tokens', async () => {
      await service.sendToMultiple(
        ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
        'Title',
        'Body',
      );

      expect(mockChunkPushNotifications).toHaveBeenCalled();
      expect(mockSendPushNotificationsAsync).toHaveBeenCalled();
    });

    it('filters out invalid tokens', async () => {
      await service.sendToMultiple(
        ['invalid', 'ExponentPushToken[valid]'],
        'Title',
        'Body',
      );

      expect(mockChunkPushNotifications).toHaveBeenCalledWith([
        expect.objectContaining({ to: 'ExponentPushToken[valid]' }),
      ]);
    });

    it('does nothing with empty token list', async () => {
      await service.sendToMultiple([], 'Title', 'Body');
      expect(mockChunkPushNotifications).not.toHaveBeenCalled();
      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });
  });
});
