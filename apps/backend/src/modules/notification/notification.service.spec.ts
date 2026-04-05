import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';

// Mock Expo SDK
const mockSendPushNotificationsAsync = jest.fn().mockResolvedValue([]);
const mockChunkPushNotifications = jest.fn((messages: unknown[]) => [messages]);

jest.mock('expo-server-sdk', () => {
  return {
    Expo: jest.fn().mockImplementation(() => ({
      sendPushNotificationsAsync: mockSendPushNotificationsAsync,
      chunkPushNotifications: mockChunkPushNotifications,
    })),
  };
});

// Access static methods on the mock
const ExpoMock = jest.requireMock('expo-server-sdk').Expo;
ExpoMock.isExpoPushToken = jest.fn((token: string) =>
  token.startsWith('ExponentPushToken['),
);

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService],
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
      await service.sendPushNotification(
        'invalid-token',
        'Title',
        'Body',
      );

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

      // Should only include the valid token
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
